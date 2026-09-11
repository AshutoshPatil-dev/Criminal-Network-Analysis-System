import neo4j, { type Driver } from 'neo4j-driver-lite';
import type { Entity, Relationship } from '../types';

const URI = import.meta.env.VITE_NEO4J_URI || '';
const USER = import.meta.env.VITE_NEO4J_USER || '';
const PASSWORD = import.meta.env.VITE_NEO4J_PASSWORD || '';

let driverInstance: Driver | null = null;

export function getNeo4jDriver(): Driver | null {
  if (!URI || !USER || !PASSWORD) return null;
  if (!driverInstance) {
    try {
      driverInstance = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
    } catch (err) {
      console.error('Failed to initialize Neo4j driver:', err);
      return null;
    }
  }
  return driverInstance;
}

// Test connectivity to Neo4j AuraDB
export async function testNeo4jConnection(): Promise<{ ok: boolean; message: string }> {
  const driver = getNeo4jDriver();
  if (!driver) return { ok: false, message: 'Neo4j credentials not configured in .env' };

  try {
    const serverInfo = await driver.getServerInfo();
    return {
      ok: true,
      message: `Connected to Neo4j AuraDB (${serverInfo.agent || 'Aura Cloud'})`,
    };
  } catch (error) {
    return { ok: false, message: `Neo4j Connection Failed: ${String(error)}` };
  }
}

// Sync entities & relationships from Supabase into Neo4j
export async function syncGraphToNeo4j(
  entities: Entity[],
  relationships: Relationship[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const driver = getNeo4jDriver();
  if (!driver) return { ok: false, count: 0, error: 'Neo4j driver not available.' };

  const session = driver.session();
  let synced = 0;

  try {
    // 1. Create Nodes
    for (const e of entities) {
      await session.run(
        `MERGE (n:Entity {id: $id})
         SET n.name = $name, n.type = $type, n.riskScore = $riskScore, n.role = $role`,
        {
          id: e.id,
          name: e.name,
          type: e.type,
          riskScore: e.riskScore,
          role: e.attributes.role || 'Unspecified',
        }
      );
      synced++;
    }

    // 2. Create Relationships
    for (const r of relationships) {
      await session.run(
        `MATCH (a:Entity {id: $source}), (b:Entity {id: $target})
         MERGE (a)-[rel:CONNECTED {type: $type}]->(b)
         SET rel.count = $count`,
        {
          source: r.source,
          target: r.target,
          type: r.type,
          count: r.count,
        }
      );
    }

    return { ok: true, count: synced };
  } catch (err) {
    return { ok: false, count: synced, error: String(err) };
  } finally {
    await session.close();
  }
}

// Run a Cypher Query
export async function runCypherQuery(query: string): Promise<Record<string, unknown>[]> {
  const driver = getNeo4jDriver();
  if (!driver) throw new Error('Neo4j driver not connected.');

  const session = driver.session();
  try {
    const result = await session.run(query);
    return result.records.map(record => record.toObject());
  } finally {
    await session.close();
  }
}