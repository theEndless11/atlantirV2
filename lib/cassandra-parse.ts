// Parse Cassandra connection string into driver options
// Supports formats:
//   cassandra://user:pass@host1,host2:9042/keyspace?datacenter=dc1
//   cassandra://host:9042/keyspace?datacenter=dc1
//   cassandra://host:9042?keyspace=ks&datacenter=dc1
export function parseCassandraUrl(connStr: string): any {
  try {
    // Normalize protocol
    const normalized = connStr
      .replace(/^scylla:\/\//, 'cassandra://')
      .replace(/^cassandra:\/\//, 'http://')

    const url = new URL(normalized)
    const params = Object.fromEntries(url.searchParams.entries())

    // Contact points — host can be comma-separated before @
    const rawHost = url.hostname
    const contactPoints = rawHost.split(',').map(h => h.trim()).filter(Boolean)
    if (!contactPoints.length) contactPoints.push('localhost')

    const port = url.port ? parseInt(url.port) : 9042

    // Keyspace from path or query param
    const keyspace = url.pathname.replace(/^\//, '') || params.keyspace || undefined

    // Datacenter from query param
    const datacenter = params.datacenter || 'datacenter1'

    // Auth
    const username = url.username || undefined
    const password = url.password || undefined

    const opts: any = {
      contactPoints,
      localDataCenter: datacenter,
      protocolOptions: { port },
      socketOptions: { connectTimeout: 8000 }
    }

    if (keyspace) opts.keyspace = keyspace
    if (username && password) opts.credentials = { username, password }
    else if (username) opts.credentials = { username, password: '' }

    return opts
  } catch (e: any) {
    throw new Error('Invalid Cassandra connection string: ' + e.message)
  }
}