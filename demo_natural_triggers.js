#!/usr/bin/env node
/**
 * Natural Memory Triggers Interactive Demo
 * Demonstrates how the system detects patterns and decides to inject memories
 */

const path = require('path');
const readline = require('readline');

const config = require(path.join(process.env.HOME, '.claude/hooks/config.json'));
const { MidConversationHook } = require(path.join(process.env.HOME, '.claude/hooks/core/mid-conversation.js'));

// ANSI colors
const C = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    CYAN: '\x1b[36m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    RED: '\x1b[31m',
    MAGENTA: '\x1b[35m',
    GRAY: '\x1b[90m'
};

/**
 * Create a simulated conversation interface
 */
class NaturalTriggerDemo {
    constructor() {
        this.hook = new MidConversationHook(config);
        this.conversationHistory = [];
        this.triggerCount = 0;
    }

    /**
     * Analyze a user message and show decision-making process
     */
    async analyzeMessage(userMessage) {
        console.log(`\n${C.CYAN}${C.BRIGHT}╔════════════════════════════════════════════════════════════════════╗${C.RESET}`);
        console.log(`${C.CYAN}${C.BRIGHT}║${C.RESET} 💬 User: "${userMessage.substring(0, 60)}..."${' '.repeat(Math.max(0, 60 - userMessage.length))} ${C.CYAN}${C.BRIGHT}║${C.RESET}`);
        console.log(`${C.CYAN}${C.BRIGHT}╚════════════════════════════════════════════════════════════════════╝${C.RESET}`);

        // Store in conversation history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
        });

        // Build context from conversation
        const context = {
            conversationHistory: this.conversationHistory,
            projectContext: {
                name: 'mcp-memory-service',
                language: 'JavaScript',
                frameworks: ['Node.js', 'FastAPI'],
                branch: 'main'
            },
            isQuestionPattern: /\?|what|how|why|when|where|which|who/i.test(userMessage),
            mentionsPastWork: /last|previous|before|earlier|remember|recall|decided|discussed/i.test(userMessage)
        };

        console.log(`\n${C.YELLOW}🔍 Analysis Process:${C.RESET}`);

        // Run analysis
        const startTime = Date.now();
        const analysis = await this.hook.analyzeMessage(userMessage, context);
        const elapsed = Date.now() - startTime;

        if (!analysis) {
            console.log(`  ${C.RED}❌ Analysis failed${C.RESET}`);
            return;
        }

        // Show detection results
        console.log(`\n  ${C.BRIGHT}Pattern Detection:${C.RESET}`);
        if (analysis.patternResults && analysis.patternResults.matches) {
            if (analysis.patternResults.matches.length > 0) {
                analysis.patternResults.matches.forEach(match => {
                    console.log(`    ✓ ${C.GREEN}${match.pattern}${C.RESET} (${match.category})`);
                });
                console.log(`    ${C.GRAY}Base confidence: ${(analysis.patternResults.confidence * 100).toFixed(0)}%${C.RESET}`);
            } else {
                console.log(`    ${C.GRAY}No patterns matched${C.RESET}`);
            }
        }

        console.log(`\n  ${C.BRIGHT}Conversation Analysis:${C.RESET}`);
        if (analysis.conversationAnalysis) {
            const ca = analysis.conversationAnalysis;
            console.log(`    Topics: ${C.CYAN}${ca.topics.join(', ') || 'none'}${C.RESET}`);
            console.log(`    Trigger probability: ${this.getColoredPercentage(ca.triggerProbability)}`);
            console.log(`    Semantic shift: ${this.getColoredPercentage(ca.semanticShift)}`);
        }

        console.log(`\n  ${C.BRIGHT}Context Adjustments:${C.RESET}`);
        if (context.isQuestionPattern) {
            console.log(`    ${C.GREEN}+${C.RESET} Question pattern detected (+10% boost)`);
        }
        if (context.mentionsPastWork) {
            console.log(`    ${C.GREEN}+${C.RESET} References past work (+15% boost)`);
        }

        console.log(`\n  ${C.BRIGHT}Performance:${C.RESET}`);
        console.log(`    Latency: ${C.CYAN}${elapsed}ms${C.RESET}`);
        if (analysis.performance) {
            console.log(`    Tier: ${C.CYAN}${analysis.performance.tier || 'unknown'}${C.RESET}`);
        }

        // Final decision
        console.log(`\n${C.BRIGHT}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.RESET}`);

        if (analysis.shouldTrigger) {
            this.triggerCount++;
            console.log(`\n  ${C.GREEN}${C.BRIGHT}🔥 TRIGGER ACTIVATED${C.RESET}`);
            console.log(`  ${C.GREEN}Confidence: ${(analysis.confidence * 100).toFixed(0)}%${C.RESET} (threshold: ${(config.naturalTriggers.triggerThreshold * 100).toFixed(0)}%)`);
            console.log(`  ${C.GREEN}Action: Injecting relevant memories into context${C.RESET}`);
            console.log(`  ${C.GRAY}Reasoning: ${analysis.reasoning}${C.RESET}`);

            // Show what would be queried
            console.log(`\n  ${C.MAGENTA}📋 Memory Query:${C.RESET}`);
            console.log(`    ${C.GRAY}Would retrieve: ${config.naturalTriggers.maxMemoriesPerTrigger} memories${C.RESET}`);
            console.log(`    ${C.GRAY}Topics: ${(analysis.conversationAnalysis?.topics || []).join(', ')}${C.RESET}`);
            console.log(`    ${C.GRAY}Project: ${context.projectContext.name}${C.RESET}`);

        } else {
            console.log(`\n  ${C.RED}❄️  NO TRIGGER${C.RESET}`);
            console.log(`  ${C.RED}Confidence: ${(analysis.confidence * 100).toFixed(0)}%${C.RESET} (below ${(config.naturalTriggers.triggerThreshold * 100).toFixed(0)}% threshold)`);
            console.log(`  ${C.GRAY}Reasoning: ${analysis.reasoning}${C.RESET}`);
        }

        console.log(`${C.BRIGHT}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.RESET}`);

        return analysis;
    }

    /**
     * Helper: Get colored percentage display
     */
    getColoredPercentage(value) {
        const percent = (value * 100).toFixed(0);
        let color;
        if (value >= 0.7) color = C.GREEN;
        else if (value >= 0.4) color = C.YELLOW;
        else color = C.GRAY;
        return `${color}${percent}%${C.RESET}`;
    }

    /**
     * Show current status
     */
    showStatus() {
        const status = this.hook.getStatus();

        console.log(`\n${C.CYAN}${C.BRIGHT}📊 Current Status:${C.RESET}`);
        console.log(`  Enabled: ${status.enabled ? C.GREEN + 'YES' : C.RED + 'NO'}${C.RESET}`);
        console.log(`  Cooldown remaining: ${C.YELLOW}${(status.cooldownRemaining / 1000).toFixed(1)}s${C.RESET}`);
        console.log(`  Total analyses: ${C.CYAN}${status.analytics.totalAnalyses}${C.RESET}`);
        console.log(`  Triggers executed: ${C.GREEN}${this.triggerCount}${C.RESET}`);
        console.log(`  Average latency: ${C.CYAN}${status.analytics.averageLatency.toFixed(1)}ms${C.RESET}`);
    }

    /**
     * Run predefined scenarios
     */
    async runScenarios() {
        const scenarios = [
            {
                title: "Scenario 1: Explicit Memory Request",
                messages: [
                    "What did we decide about the authentication system?",
                    "Can you remind me of the approach we took?"
                ]
            },
            {
                title: "Scenario 2: Technical Discussion",
                messages: [
                    "The OAuth implementation needs some refactoring",
                    "Should we use SQLite-vec instead of ChromaDB?"
                ]
            },
            {
                title: "Scenario 3: Question About Past Work",
                messages: [
                    "Why did we choose FastAPI over Flask?",
                    "Following up on the migration script from last week"
                ]
            },
            {
                title: "Scenario 4: Casual Conversation (No Trigger Expected)",
                messages: [
                    "Hello!",
                    "Thanks for the help",
                    "That makes sense"
                ]
            }
        ];

        console.log(`\n${C.CYAN}${C.BRIGHT}╔═══════════════════════════════════════════════════════════════════╗${C.RESET}`);
        console.log(`${C.CYAN}${C.BRIGHT}║  NATURAL MEMORY TRIGGERS - INTERACTIVE DEMO                       ║${C.RESET}`);
        console.log(`${C.CYAN}${C.BRIGHT}╚═══════════════════════════════════════════════════════════════════╝${C.RESET}`);

        console.log(`\n${C.GRAY}Configuration:${C.RESET}`);
        console.log(`  Trigger Threshold: ${config.naturalTriggers.triggerThreshold}`);
        console.log(`  Sensitivity: ${config.patternDetector.sensitivity}`);
        console.log(`  Performance Profile: ${config.performance.defaultProfile}`);
        console.log(`  Cooldown: ${config.naturalTriggers.cooldownPeriod / 1000}s`);

        for (const scenario of scenarios) {
            console.log(`\n\n${C.MAGENTA}${C.BRIGHT}═════════════════════════════════════════════════════════════════════${C.RESET}`);
            console.log(`${C.MAGENTA}${C.BRIGHT}  ${scenario.title}${C.RESET}`);
            console.log(`${C.MAGENTA}${C.BRIGHT}═════════════════════════════════════════════════════════════════════${C.RESET}`);

            for (const message of scenario.messages) {
                await this.analyzeMessage(message);
                await this.sleep(1000); // Small delay between messages
            }

            this.showStatus();
        }

        console.log(`\n\n${C.GREEN}${C.BRIGHT}✅ Demo Complete!${C.RESET}\n`);
        console.log(`${C.GRAY}Summary:${C.RESET}`);
        console.log(`  Total messages analyzed: ${this.conversationHistory.length}`);
        console.log(`  Memory triggers executed: ${this.triggerCount}`);
        console.log(`  Trigger rate: ${((this.triggerCount / this.conversationHistory.length) * 100).toFixed(0)}%`);
    }

    /**
     * Helper: Sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup
     */
    async cleanup() {
        await this.hook.cleanup();
    }
}

/**
 * Main
 */
async function main() {
    const demo = new NaturalTriggerDemo();

    try {
        await demo.runScenarios();
    } catch (error) {
        console.error(`${C.RED}Error: ${error.message}${C.RESET}`);
        console.error(error.stack);
    } finally {
        await demo.cleanup();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { NaturalTriggerDemo };