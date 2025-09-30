#!/usr/bin/env node
/**
 * Natural Memory Triggers Test
 * Tests intelligent pattern detection and mid-conversation memory injection
 */

const path = require('path');

// Load config and components
const config = require(path.join(process.env.HOME, '.claude/hooks/config.json'));
const { MidConversationHook } = require(path.join(process.env.HOME, '.claude/hooks/core/mid-conversation.js'));
const { AdaptivePatternDetector } = require(path.join(process.env.HOME, '.claude/hooks/utilities/adaptive-pattern-detector.js'));
const { TieredConversationMonitor } = require(path.join(process.env.HOME, '.claude/hooks/utilities/tiered-conversation-monitor.js'));

// ANSI colors
const COLORS = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    CYAN: '\x1b[36m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    RED: '\x1b[31m',
    GRAY: '\x1b[90m'
};

/**
 * Test messages that should trigger memory retrieval
 */
const TEST_MESSAGES = {
    explicitMemoryRequest: [
        "What did we decide about the authentication system?",
        "Can you remind me what happened last time we worked on this?",
        "What was the previous approach we tried for this?",
        "Did we discuss the database migration before?"
    ],

    technicalDiscussion: [
        "We need to refactor the API endpoints to support OAuth 2.1",
        "The ChromaDB backend has performance issues with large datasets",
        "Should we use SQLite-vec instead of ChromaDB for better speed?",
        "How do we handle rate limiting in the memory service?"
    ],

    questionPattern: [
        "Why did we choose FastAPI over Flask?",
        "How does the tiered processing work?",
        "What's the difference between instant and fast tiers?",
        "When should we use the adaptive performance profile?"
    ],

    pastWorkReference: [
        "Following up on the migration script we wrote",
        "Continuing from our last session on hooks",
        "Building on the authentication work from yesterday",
        "Related to the bug fix we did last week"
    ],

    noTriggerExpected: [
        "Hello!",
        "Thanks for the help",
        "That makes sense",
        "Okay, got it"
    ]
};

/**
 * Run pattern detection tests
 */
async function testPatternDetection() {
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}  PATTERN DETECTION TESTS${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}\n`);

    const patternDetector = new AdaptivePatternDetector(config.patternDetector);

    for (const [category, messages] of Object.entries(TEST_MESSAGES)) {
        console.log(`${COLORS.YELLOW}📂 Category: ${category}${COLORS.RESET}`);

        for (const message of messages) {
            const result = await patternDetector.detectPatterns(message, {});

            const triggerIcon = result.triggerRecommendation ? '✅' : '❌';
            const confidence = (result.confidence * 100).toFixed(0);
            const confidenceColor = result.confidence > 0.6 ? COLORS.GREEN : COLORS.GRAY;

            console.log(`  ${triggerIcon} ${confidenceColor}[${confidence}%]${COLORS.RESET} "${message.substring(0, 60)}..."`);

            if (result.matches.length > 0) {
                const matchedPatterns = result.matches.map(m => m.pattern).join(', ');
                console.log(`     ${COLORS.GRAY}Patterns: ${matchedPatterns}${COLORS.RESET}`);
            }
        }
        console.log();
    }
}

/**
 * Test mid-conversation hook decision making
 */
async function testMidConversationHook() {
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}  MID-CONVERSATION HOOK TESTS${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}\n`);

    const hook = new MidConversationHook(config);

    const testCases = [
        {
            message: "What did we decide about authentication?",
            expected: true,
            context: { isQuestionPattern: true }
        },
        {
            message: "The OAuth implementation needs refactoring",
            expected: true,
            context: { mentionsPastWork: true }
        },
        {
            message: "Hello",
            expected: false,
            context: {}
        },
        {
            message: "Following up on our hooks discussion from last week",
            expected: true,
            context: { mentionsPastWork: true, isQuestionPattern: false }
        }
    ];

    for (const testCase of testCases) {
        console.log(`${COLORS.YELLOW}Testing:${COLORS.RESET} "${testCase.message}"`);

        const analysis = await hook.analyzeMessage(testCase.message, testCase.context);

        if (analysis) {
            const triggerIcon = analysis.shouldTrigger ? '🔥' : '❄️';
            const confidence = (analysis.confidence * 100).toFixed(0);
            const latency = analysis.performance?.latency?.toFixed(1) || 'N/A';

            const expectedIcon = testCase.expected === analysis.shouldTrigger ? '✅' : '❌';

            console.log(`  ${expectedIcon} ${triggerIcon} Trigger: ${analysis.shouldTrigger} (${confidence}% confidence, ${latency}ms)`);
            console.log(`     ${COLORS.GRAY}Reasoning: ${analysis.reasoning}${COLORS.RESET}`);

            if (analysis.conversationAnalysis) {
                console.log(`     ${COLORS.GRAY}Conversation prob: ${(analysis.conversationAnalysis.triggerProbability * 100).toFixed(0)}%${COLORS.RESET}`);
            }

            if (analysis.performance) {
                const tier = analysis.performance.tier || 'unknown';
                console.log(`     ${COLORS.GRAY}Performance tier: ${tier}${COLORS.RESET}`);
            }
        } else {
            console.log(`  ${COLORS.RED}❌ Analysis failed${COLORS.RESET}`);
        }

        console.log();
    }
}

/**
 * Test tiered processing performance
 */
async function testTieredProcessing() {
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}  TIERED PROCESSING TESTS${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}\n`);

    const conversationMonitor = new TieredConversationMonitor(config.conversationMonitor);

    const messages = [
        "Quick question about the API",
        "I need to understand how the authentication flow works in detail",
        "Can you explain the entire architecture from scratch?"
    ];

    console.log(`${COLORS.YELLOW}Testing message complexity detection:${COLORS.RESET}\n`);

    for (const message of messages) {
        console.log(`Message: "${message}"`);

        const startTime = Date.now();
        const analysis = await conversationMonitor.analyzeMessage(message, {});
        const elapsed = Date.now() - startTime;

        console.log(`  ⚡ Latency: ${elapsed}ms`);
        console.log(`  🎯 Topics: ${analysis.topics.join(', ') || 'none'}`);
        console.log(`  📊 Trigger probability: ${(analysis.triggerProbability * 100).toFixed(0)}%`);
        console.log(`  🔄 Semantic shift: ${(analysis.semanticShift * 100).toFixed(0)}%`);
        console.log();
    }
}

/**
 * Test performance profiles
 */
async function testPerformanceProfiles() {
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}  PERFORMANCE PROFILE COMPARISON${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}\n`);

    const profiles = ['speed_focused', 'balanced', 'memory_aware'];
    const testMessage = "What was our decision about using SQLite-vec?";

    console.log(`${COLORS.YELLOW}Testing message:${COLORS.RESET} "${testMessage}"\n`);

    for (const profileName of profiles) {
        console.log(`${COLORS.GREEN}Profile: ${profileName}${COLORS.RESET}`);

        const profileConfig = { ...config };
        profileConfig.performance.defaultProfile = profileName;

        const hook = new MidConversationHook(profileConfig);

        const startTime = Date.now();
        const analysis = await hook.analyzeMessage(testMessage, {});
        const elapsed = Date.now() - startTime;

        if (analysis) {
            const profile = config.performance.profiles[profileName];
            console.log(`  ⚡ Latency: ${elapsed}ms (max: ${profile.maxLatency}ms)`);
            console.log(`  🎯 Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
            console.log(`  🔥 Trigger: ${analysis.shouldTrigger ? 'YES' : 'NO'}`);
            console.log(`  📊 Enabled tiers: ${profile.enabledTiers.join(', ')}`);
        }

        await hook.cleanup();
        console.log();
    }
}

/**
 * Test cooldown period
 */
async function testCooldownPeriod() {
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}  COOLDOWN PERIOD TEST${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}═══════════════════════════════════════════${COLORS.RESET}\n`);

    const hook = new MidConversationHook(config);
    const message = "What did we decide about authentication?";

    console.log(`${COLORS.YELLOW}Testing cooldown period (${config.naturalTriggers.cooldownPeriod / 1000}s):${COLORS.RESET}\n`);

    // First trigger
    console.log('1️⃣  First trigger attempt:');
    const result1 = await hook.analyzeMessage(message, {});
    console.log(`   Trigger: ${result1.shouldTrigger ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Confidence: ${(result1.confidence * 100).toFixed(0)}%\n`);

    // Immediate second trigger (should be blocked by cooldown)
    console.log('2️⃣  Immediate second trigger (should be blocked):');
    const result2 = await hook.analyzeMessage(message, {});
    console.log(`   Trigger: ${result2.shouldTrigger ? 'YES ❌' : 'NO ✅'}`);
    console.log(`   Reason: ${result2.reasoning}\n`);

    // Check status
    const status = hook.getStatus();
    console.log(`📊 Hook Status:`);
    console.log(`   Cooldown remaining: ${(status.cooldownRemaining / 1000).toFixed(1)}s`);
    console.log(`   Total analyses: ${status.analytics.totalAnalyses}`);
    console.log(`   Triggers executed: ${status.analytics.triggersExecuted}`);

    await hook.cleanup();
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log(`\n${COLORS.BRIGHT}🧪 Natural Memory Triggers & Mid-Conversation Hooks Test Suite${COLORS.RESET}`);
    console.log(`${COLORS.GRAY}Testing intelligent pattern detection and dynamic memory injection${COLORS.RESET}\n`);

    try {
        await testPatternDetection();
        await testMidConversationHook();
        await testTieredProcessing();
        await testPerformanceProfiles();
        await testCooldownPeriod();

        console.log(`\n${COLORS.GREEN}${COLORS.BRIGHT}✅ All tests completed!${COLORS.RESET}\n`);

        console.log(`${COLORS.CYAN}📊 Summary:${COLORS.RESET}`);
        console.log(`   Natural Triggers: ${config.naturalTriggers.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
        console.log(`   Trigger Threshold: ${config.naturalTriggers.triggerThreshold}`);
        console.log(`   Sensitivity: ${config.patternDetector.sensitivity}`);
        console.log(`   Current Profile: ${config.performance.defaultProfile}`);
        console.log(`   Cooldown Period: ${config.naturalTriggers.cooldownPeriod / 1000}s`);

    } catch (error) {
        console.error(`\n${COLORS.RED}❌ Test suite failed: ${error.message}${COLORS.RESET}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests };