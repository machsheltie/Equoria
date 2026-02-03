/**
 * Script to update React Router imports in test files
 * Changes from 'react-router-dom' to relative '../test/utils' path
 */

const fs = require('fs');
const path = require('path');

const files = [
  'src/components/competition/__tests__/XpIntegration.test.tsx',
  'src/pages/__tests__/CompetitionResultsPage.test.tsx',
  'src/components/competition/__tests__/PrizeIntegration.test.tsx',
  'src/components/competition/__tests__/CompetitionResultsModal.test.tsx',
  'src/pages/__tests__/PrizeHistoryPage.test.tsx',
  'src/pages/__tests__/CompetitionBrowserPage.test.tsx',
  'src/pages/__tests__/RegisterPage.test.tsx',
  'src/pages/__tests__/ProfilePage.test.tsx',
  'src/pages/__tests__/HorseDetailPage.test.tsx',
  'src/pages/__tests__/HorseDetailPage.ProgressionTab.test.tsx',
  'src/pages/__tests__/HorseDetailPage.GeneticsTab.test.tsx',
  'src/pages/__tests__/ForgotPasswordPage.test.tsx',
  'src/components/training/__tests__/TrainingDashboard.test.tsx',
  'src/components/__tests__/UserDashboard.test.tsx',
  'src/components/__tests__/MyGroomsDashboard.test.tsx',
  'src/components/__tests__/MainNavigation.test.tsx',
  'src/components/__tests__/HorseListView.test.tsx',
  'src/components/__tests__/HorseDetailView.test.tsx',
  'src/components/__tests__/GroomList.test.tsx',
  'src/components/__tests__/CompetitionBrowser.test.tsx',
  'src/components/__tests__/AssignGroomModal.test.tsx',
  'src/pages/__tests__/TrainingDashboardPage.test.tsx',
  'src/pages/__tests__/HorseDetailPage.Training.test.tsx',
  'src/pages/__tests__/StableView.test.tsx',
  'src/pages/__tests__/LeaderboardsPage.test.tsx',
  'src/components/leaderboard/__tests__/LeaderboardsIntegration.test.tsx',
  'src/hooks/__tests__/useSessionGuard.test.tsx',
  'src/hooks/__tests__/useRoleGuard.test.tsx',
  'src/components/auth/__tests__/RoleProtectedRoute.test.tsx',
  'src/components/__tests__/HorseSearchFilter.integration.test.tsx',
  'src/hooks/__tests__/useHorseFilters.test.tsx',
];

let updated = 0;
let failed = 0;

files.forEach(filePath => {
  try {
    // Calculate relative path depth
    const depth = filePath.split('/').length - 2; // -2 for 'src/' and filename
    const relPath = '../'.repeat(depth) + 'test/utils';

    const fullPath = path.join(__dirname, filePath);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Replace the import
    const newContent = content.replace(
      /from ['"]react-router-dom['"]/g,
      `from '${relPath}'`
    );

    if (newContent !== content) {
      fs.writeFileSync(fullPath, newContent, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      updated++;
    } else {
      console.log(`⏭️  No change: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Failed: ${filePath} - ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Summary: ${updated} updated, ${failed} failed, ${files.length} total`);
