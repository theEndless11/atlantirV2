export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON schema
  riskLevel: 'safe' | 'dangerous'
}

export interface ToolExecutor {
  initiateOAuth(args: {
    app: string
    entityId: string   // 'ws:<workspaceId>:emp:<employeeId>'
    redirectUrl: string
    scopes?: string[]
  }): Promise<{ redirectUrl: string; connectionId: string }>

  getConnectionStatus(entityId: string, app: string): Promise<'connected' | 'expired' | 'none'>

  revokeConnection(entityId: string, app: string): Promise<void>

  listActions(app: string): Promise<ToolSchema[]>

  execute(args: {
    action: string
    entityId: string
    params: Record<string, unknown>
    approvalTokenId?: string  // required for dangerous actions
  }): Promise<{ success: boolean; result?: unknown; error?: string; auditId: string }>
}

export class ToolExecutorError extends Error {
  constructor(
    public code: 'APPROVAL_REQUIRED' | 'CONNECTION_EXPIRED' | 'RATE_LIMITED' | 'UNKNOWN',
    message: string
  ) {
    super(message)
    this.name = 'ToolExecutorError'
  }
}
