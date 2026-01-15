#!/usr/bin/env node
/**
 * Extract all n8n nodes from the nodes-base package
 * Scans the actual TypeScript files to get node metadata
 * 
 * Run: node scripts/extract-node-registry.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../src/server/data/nodes-registry.json');

// Path to n8n nodes-base in the project
const N8N_NODES_PATH = path.join(__dirname, '../../n8n/packages/nodes-base/nodes');
const N8N_VERSION = '2.3.4';  // Update when syncing

// Node category colors (matches n8n styling)
const CATEGORY_COLORS = {
    'Trigger': '#ff6d5a',
    'Flow': '#ff9922',
    'Core': '#36a2eb',
    'Data Transformation': '#00b8d9',
    'Network': '#7e57c2',
    'Communication': '#00c853',
    'Data': '#448aff',
    'Database': '#795548',
    'Files': '#9c27b0',
    'AI': '#e91e63',
    'Development': '#607d8b',
    'Productivity': '#009688',
    'CRM': '#f44336',
    'Commerce': '#ffca28',
    'Finance': '#4caf50',
    'Marketing': '#ff5722',
    'Analytics': '#3f51b5',
    'Social': '#03a9f4',
    'Utility': '#9e9e9e',
    'Other': '#666666',
};

// Infer category from directory structure or node name
function inferCategory(nodeName) {
    const lowercaseName = nodeName.toLowerCase();

    if (lowercaseName.includes('trigger')) return 'Trigger';
    if (['If', 'Switch', 'Merge', 'SplitInBatches', 'Wait', 'NoOp', 'Loop'].some(n => nodeName.includes(n))) return 'Flow';
    if (['Set', 'Code', 'Function', 'Html', 'Markdown', 'Xml', 'Json'].some(n => nodeName.includes(n))) return 'Data Transformation';
    if (['Http', 'Webhook', 'GraphQL', 'Ssh', 'Ftp'].some(n => nodeName.includes(n))) return 'Network';
    if (['Slack', 'Discord', 'Telegram', 'Gmail', 'Email', 'Sms', 'Twilio'].some(n => nodeName.includes(n))) return 'Communication';
    if (['Postgres', 'Mysql', 'Mongodb', 'Redis', 'Supabase', 'Sqlite', 'Qdrant'].some(n => nodeName.includes(n))) return 'Database';
    if (['S3', 'Dropbox', 'GoogleDrive', 'OneDrive', 'Box', 'Ftp'].some(n => nodeName.includes(n))) return 'Files';
    if (['OpenAi', 'Anthropic', 'Ollama', 'Pinecone', 'Langchain', 'AiTransform'].some(n => nodeName.includes(n))) return 'AI';
    if (['Github', 'Gitlab', 'Bitbucket', 'Jenkins', 'Docker'].some(n => nodeName.includes(n))) return 'Development';
    if (['Notion', 'Todoist', 'Trello', 'Asana', 'Jira', 'Linear', 'Monday'].some(n => nodeName.includes(n))) return 'Productivity';
    if (['Hubspot', 'Salesforce', 'Pipedrive', 'Zoho', 'Crm'].some(n => nodeName.includes(n))) return 'CRM';
    if (['Shopify', 'WooCommerce', 'Stripe', 'Paypal'].some(n => nodeName.includes(n))) return 'Commerce';
    if (['GoogleAnalytics', 'Mixpanel', 'Amplitude'].some(n => nodeName.includes(n))) return 'Analytics';
    if (['Twitter', 'Facebook', 'Instagram', 'LinkedIn', 'Reddit'].some(n => nodeName.includes(n))) return 'Social';
    if (['Mailchimp', 'Sendgrid', 'Brevo', 'ActiveCampaign'].some(n => nodeName.includes(n))) return 'Marketing';
    if (['GoogleSheets', 'Airtable', 'Baserow', 'NocoDB'].some(n => nodeName.includes(n))) return 'Data';

    return 'Other';
}

// Scan a node directory for .node.ts or .node.json files
function extractNodeInfo(nodeDir, nodeName) {
    const nodes = [];

    try {
        const files = fs.readdirSync(nodeDir);

        // Look for main node files (.node.ts)
        const nodeFiles = files.filter(f => f.endsWith('.node.ts') || f.endsWith('.node.json'));

        if (nodeFiles.length === 0) {
            // Maybe it's in a subdirectory
            const subdirs = files.filter(f => {
                const subpath = path.join(nodeDir, f);
                return fs.statSync(subpath).isDirectory() && !f.startsWith('.');
            });

            for (const subdir of subdirs) {
                const subResults = extractNodeInfo(path.join(nodeDir, subdir), subdir);
                nodes.push(...subResults);
            }
        } else {
            const category = inferCategory(nodeName);
            nodes.push({
                type: `n8n-nodes-base.${nodeName.charAt(0).toLowerCase() + nodeName.slice(1)}`,
                displayName: nodeName.replace(/([A-Z])/g, ' $1').trim(),
                category,
                color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'],
                icon: `file:${nodeName.toLowerCase()}.svg`,
                inputs: ['main'],
                outputs: ['main'],
            });
        }
    } catch (error) {
        console.warn(`Warning: Could not scan ${nodeDir}: ${error.message}`);
    }

    return nodes;
}

async function main() {
    console.log(`📦 Extracting n8n node registry (n8n@${N8N_VERSION})`);
    console.log(`📁 Source: ${N8N_NODES_PATH}`);

    if (!fs.existsSync(N8N_NODES_PATH)) {
        console.error(`❌ Error: Nodes directory not found at ${N8N_NODES_PATH}`);
        console.log('Please ensure n8n is cloned in the expected location.');
        process.exit(1);
    }

    const nodeDirs = fs.readdirSync(N8N_NODES_PATH).filter(f => {
        const fullPath = path.join(N8N_NODES_PATH, f);
        return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
    });

    console.log(`🔍 Found ${nodeDirs.length} node directories`);

    const allNodes = [];

    for (const nodeName of nodeDirs) {
        const nodeDir = path.join(N8N_NODES_PATH, nodeName);
        const extracted = extractNodeInfo(nodeDir, nodeName);
        allNodes.push(...extracted);
    }

    // Group by category and count
    const categoryStats = {};
    for (const node of allNodes) {
        categoryStats[node.category] = (categoryStats[node.category] || 0) + 1;
    }

    console.log('\n📊 Category breakdown:');
    Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));

    const registry = {
        version: N8N_VERSION,
        generatedAt: new Date().toISOString(),
        totalNodes: allNodes.length,
        categories: Object.keys(CATEGORY_COLORS).map(name => ({
            name,
            color: CATEGORY_COLORS[name],
            count: categoryStats[name] || 0
        })),
        nodes: allNodes.sort((a, b) => a.displayName.localeCompare(b.displayName))
    };

    // Ensure data directory exists
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(registry, null, 2));
    console.log(`\n✅ Generated ${allNodes.length} node definitions`);
    console.log(`📁 Saved to: ${OUTPUT_FILE}`);
}

main().catch(console.error);
