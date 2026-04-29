import { tool } from 'ai'
import { z } from 'zod'
import { TOOL_REGISTRY, isActionDangerous } from './registry'
import type { ToolExecutor } from './types'

/**
 * Convert a JSON Schema property definition to a Zod schema.
 * Handles string, number, boolean, and enum types.
 */
function jsonSchemaPropertyToZod(
  prop: Record<string, unknown>
): z.ZodTypeAny {
  const type = prop.type as string | undefined
  const enumValues = prop.enum as string[] | undefined
  const desc = (prop.description as string | undefined) ?? ''

  if (enumValues?.length) {
    const [first, ...rest] = enumValues as [string, ...string[]]
    return z.enum([first, ...rest]).describe(desc).optional()
  }

  switch (type) {
    case 'string':
      return z.string().describe(desc).optional()
    case 'number':
    case 'integer':
      return z.number().describe(desc).optional()
    case 'boolean':
      return z.boolean().describe(desc).optional()
    default:
      return z.unknown().optional()
  }
}

/**
 * Convert a tool registry's JSON schema parameters block into a Zod object schema.
 */
function buildZodSchema(
  parameters: Record<string, unknown>
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const properties = (parameters.properties as Record<string, Record<string, unknown>>) ?? {}
  const required = (parameters.required as string[]) ?? []

  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, prop] of Object.entries(properties)) {
    let field = jsonSchemaPropertyToZod(prop)
    if (required.includes(key)) {
      // Make required fields non-optional by unwrapping the optional wrapper
      const inner = jsonSchemaPropertyToZod({ ...prop, _required: true })
      field = inner instanceof z.ZodOptional ? inner.unwrap() : inner
    }
    shape[key] = field
  }

  return z.object(shape)
}

/**
 * Build the full tool set for an agent call.
 *
 * Safe tools get an `execute` function (auto-run by the AI SDK).
 * Dangerous tools do NOT get an `execute` function (bounces to UI for Layer 1 HITL)
 * UNLESS `approvedActions` is provided (used in background Workflow SDK tasks where
 * Layer 2 HITL has already approved via waitForEvent).
 */
export function buildAgentTools(opts: {
  workspaceId: string
  employeeId: string
  executor: ToolExecutor
  /** If provided, dangerous tools also get execute — actionName → approvalTokenId */
  approvedActions?: Map<string, string>
}): Record<string, ReturnType<typeof tool>> {
  const { workspaceId, employeeId, executor, approvedActions } = opts
  const entityId = `ws:${workspaceId}:emp:${employeeId}`
  const result: Record<string, ReturnType<typeof tool>> = {}

  for (const [actionName, schema] of Object.entries(TOOL_REGISTRY)) {
    const zodSchema = buildZodSchema(schema.parameters)
    const isDangerous = isActionDangerous(actionName)

    // Determine if we should attach an execute function
    const approvalTokenId = approvedActions?.get(actionName)
    const shouldAutoExecute = !isDangerous || (!!approvedActions && !!approvalTokenId)

    if (shouldAutoExecute) {
      result[actionName] = tool({
        description: schema.description,
        parameters: zodSchema,
        execute: async (params) => {
          return executor.execute({
            action: actionName,
            entityId,
            params: params as Record<string, unknown>,
            approvalTokenId: isDangerous ? approvalTokenId : undefined,
          })
        },
      })
    } else {
      // No execute fn → AI SDK bounces this to the UI (Layer 1 HITL)
      result[actionName] = tool({
        description: schema.description,
        parameters: zodSchema,
      })
    }
  }

  return result
}
