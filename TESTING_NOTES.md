# Testing Notes for Timestamp-Based Sync

## Feature: Subject Data Version Checking

This document describes how to manually test the timestamp-based version checking feature.

### Test Scenario 1: Local Newer Than Remote

**Setup:**
1. Open the app and sign in with Google
2. Create/update a subject with some grades (e.g., "ASI")
3. Note the timestamp (should be recent)
4. Use browser DevTools to manually modify localStorage for that subject with an older timestamp:
   ```javascript
   let data = JSON.parse(localStorage.getItem('subjectData:ASI'));
   // Change values to simulate older remote data
   data.values.parcial1_1 = '5';
   data.savedAt = '2024-01-01T00:00:00.000Z'; // Old timestamp
   // Simulate this being the remote version by uploading it manually
   ```
5. Then update the subject locally with new grades
6. Refresh the page

**Expected Result:**
- The local version (with newer timestamp) should be preserved
- After sync, Firestore should be updated with the local version

### Test Scenario 2: Remote Newer Than Local

**Setup:**
1. Open the app on Device A and update a subject
2. Open the app on Device B (same user)
3. Update the same subject on Device B with different grades
4. Return to Device A and refresh

**Expected Result:**
- Device A should show the grades from Device B (remote newer)
- The timestamp comparison should prefer the newer version

### Test Scenario 3: Subject Only Exists Locally

**Setup:**
1. Create a new subject entry locally while offline
2. Go back online and trigger sync (by refreshing or waiting for auto-sync)

**Expected Result:**
- The local-only subject should be uploaded to Firestore
- Other devices should see this subject after syncing

### Test Scenario 4: Subject Only Exists Remotely

**Setup:**
1. Clear local storage
2. Ensure Firestore has subject data
3. Sign in and trigger download

**Expected Result:**
- All remote subjects should be downloaded to local storage
- The app should display all subjects correctly

## Verification Commands

Use these commands in browser DevTools console:

```javascript
// Check all subject data in localStorage
Object.keys(localStorage)
  .filter(k => k.startsWith('subjectData:'))
  .forEach(k => console.log(k, JSON.parse(localStorage.getItem(k))));

// Check a specific subject's timestamp
let data = JSON.parse(localStorage.getItem('subjectData:ASI'));
console.log('Saved at:', data.savedAt, 'Status:', data.status);

// Manually trigger sync download
await window.firestoreDownloadAndApply();
```

## Code Review Verification

The implementation correctly handles:
- ✅ Timestamp comparison using Date objects
- ✅ Fallback to epoch (Date(0)) for missing timestamps
- ✅ Upload of local data when it's newer
- ✅ Download of remote data when it's newer
- ✅ Handling of subjects that exist only on one side
- ✅ Error handling for parse failures
- ✅ Concurrent uploads to different Firestore paths (safe operation)
