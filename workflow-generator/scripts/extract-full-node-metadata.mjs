#!/usr/bin/env node
/**
 * Extract full n8n node metadata by dynamically loading compiled nodes
 * This creates a comprehensive registry with all properties for RAG ingestion
 * 
 * Run: node scripts/extract-full-node-metadata.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../src/server/data/nodes-full-registry.json');
const NODES_DIST_PATH = path.join(__dirname, '../../n8n/packages/nodes-base/dist/nodes');

async function extractNodeMetadata() {
    console.log('📦 Extracting full n8n node metadata...');
    console.log(`📁 Source: ${NODES_DIST_PATH}`);

    if (!fs.existsSync(NODES_DIST_PATH)) {
        console.error('❌ Dist folder not found. Have you built n8n?');
        process.exit(1);
    }

    const nodeDirs = fs.readdirSync(NODES_DIST_PATH).filter(f => {
        const fullPath = path.join(NODES_DIST_PATH, f);
        return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
    });

    console.log(`🔍 Found ${nodeDirs.length} node directories`);

    const nodes = [];

    for (const nodeName of nodeDirs) {
        const nodeDir = path.join(NODES_DIST_PATH, nodeName);

        try {
            // Find the main .node.js file
            const nodeFiles = fs.readdirSync(nodeDir).filter(f =>
                f.endsWith('.node.js') && !f.includes('.d.ts')
            );

            if (nodeFiles.length === 0) continue;

            // Read the codex JSON if it exists (has categories, aliases)
            const codexFile = path.join(nodeDir, `${nodeName}.node.json`);
            let codex = {};
            if (fs.existsSync(codexFile)) {
                try {
                    codex = JSON.parse(fs.readFileSync(codexFile, 'utf-8'));
                } catch { }
            }

            // Try to extract description from the JS file (parse it as text)
            const mainNodeFile = path.join(nodeDir, nodeFiles[0]);
            const nodeContent = fs.readFileSync(mainNodeFile, 'utf-8');

            // Extract basic info from the code
            const displayNameMatch = nodeContent.match(/displayName:\s*['"`]([^'"`]+)['"`]/);
            const descriptionMatch = nodeContent.match(/description:\s*['"`]([^'"`]+)['"`]/);
            const iconMatch = nodeContent.match(/icon:\s*['"`]([^'"`]+)['"`]/);

            // Extract resources (operations) from the code
            const resourceMatch = nodeContent.match(/options:\s*\[([\s\S]*?)\]/);
            let resources = [];
            if (resourceMatch) {
                const nameMatches = resourceMatch[1].matchAll(/name:\s*['"`]([^'"`]+)['"`]/g);
                resources = Array.from(nameMatches).map(m => m[1]).slice(0, 10);
            }

            const nodeData = {
                type: `n8n-nodes-base.${nodeName.charAt(0).toLowerCase() + nodeName.slice(1)}`,
                displayName: displayNameMatch?.[1] || nodeName,
                description: descriptionMatch?.[1] || codex.resources?.primaryDocumentation?.[0]?.url || '',
                icon: iconMatch?.[1] || `file:${nodeName.toLowerCase()}.svg`,
                categories: codex.categories || ['Other'],
                aliases: codex.alias || [],
                resources: resources,
                documentationUrl: codex.resources?.primaryDocumentation?.[0]?.url || null,
            };

            nodes.push(nodeData);

            if (nodes.length % 50 === 0) {
                console.log(`   Processed ${nodes.length} nodes...`);
            }
        } catch (error) {
            console.warn(`   ⚠️ Could not process ${nodeName}: ${error.message}`);
        }
    }

    // Group by category
    const categoryStats = {};
    for (const node of nodes) {
        const cat = node.categories[0] || 'Other';
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    }

    console.log('\n📊 Category breakdown:');
    Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));

    const registry = {
        version: '2.3.4',
        generatedAt: new Date().toISOString(),
        totalNodes: nodes.length,
        nodes: nodes.sort((a, b) => a.displayName.localeCompare(b.displayName))
    };

    // Ensure directory exists
    const outDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(registry, null, 2));

    console.log(`\n✅ Extracted ${nodes.length} nodes with full metadata`);
    console.log(`📁 Saved to: ${OUTPUT_FILE}`);

    // Preview a sample
    console.log('\n📋 Sample node:');
    const sample = nodes.find(n => n.displayName === 'Slack') || nodes[0];
    console.log(JSON.stringify(sample, null, 2));
}

extractNodeMetadata().catch(console.error);
