# UTN Tracker - API Documentation

This directory contains the API endpoints for the UTN Tracker application.

## Available Endpoints

### 1. `stats.php` - User Statistics API (PHP)

A PHP-based endpoint that returns user statistics and profile data in JSON format.

#### Usage

```
GET /api/stats.php?uid=<USER_ID>
```

#### Parameters

- `uid` (required): The unique user ID from Firebase

#### Response Format

Success response:
```json
{
  "uid": "string",
  "plan": "string",
  "yearStarted": number,
  "subjectData": { ... },
  "electives": { ... },
  "selectedStats": [ ... ],
  "stats": {
    "totalSubjects": 0,
    "approvedSubjects": 0,
    "promotedSubjects": 0,
    "regularizedSubjects": 0,
    "inProgressSubjects": 0,
    "weeklyHours": 0,
    "averageGrade": 0
  },
  "public": true
}
```

Error response:
```json
{
  "error": "Error type",
  "message": "Error description"
}
```

#### Error Cases

- **Missing uid parameter**: No `uid` provided in the URL
- **User not found**: The user does not exist
- **Private profile**: The user's profile is not public
- **Server error**: An error occurred while processing the request

#### Requirements

The PHP endpoint requires:
1. PHP 8.0 or higher
2. Access to the Firebase Firestore database

#### Firebase Setup (Production)

To connect to Firebase Firestore in production, you need to:

1. Install the Firebase Admin SDK for PHP:
   ```bash
   composer require kreait/firebase-php
   ```

2. Download your Firebase service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely (DO NOT commit it to version control)

3. Update `stats.php` to use the Firebase Admin SDK:
   - Uncomment the Firebase Admin SDK code in the `getUserDataFromFirestore()` function
   - Set the correct path to your service account key file

#### Allowed Plans

For security reasons, the API only allows specific plan names:
- `k23`
- `k23medio`

If you need to add more plans, update the `$allowedPlans` array in the `loadPlanData()` function.

#### Testing Locally

For local testing without Firebase:

1. Create test data files in `api/test-data/`:
   ```bash
   mkdir api/test-data
   ```

2. Add JSON files named `<uid>.json` with user data:
   ```json
   {
     "plan": "k23",
     "yearStarted": 2023,
     "public": true,
     "subjectData": { ... },
     "electives": {},
     "selectedStats": []
   }
   ```

3. Start a local PHP server:
   ```bash
   php -S localhost:8080 -t .
   ```

4. Test the API:
   ```bash
   curl "http://localhost:8080/api/stats.php?uid=test123"
   ```

### 2. `user.html` - User Statistics API (JavaScript/Firebase)

The original JavaScript-based endpoint that uses Firebase client SDK.

#### Usage

```
GET /api/user.html?uid=<USER_ID>
```

This endpoint uses Firebase client SDK directly in the browser and returns formatted JSON in a `<pre>` tag.

## Migration Guide

The repository now supports both JavaScript (`user.html`) and PHP (`stats.php`) endpoints:

- **JavaScript endpoint (`user.html`)**: Uses Firebase client SDK, works on static hosting (GitHub Pages)
- **PHP endpoint (`stats.php`)**: Uses Firebase Admin SDK, requires PHP hosting

To migrate from JavaScript to PHP:
1. Set up PHP hosting with Firebase Admin SDK
2. Update your API calls to use `stats.php` instead of `user.html`
3. The response format is identical, so no client-side changes are needed

## Security Notes

- Never commit Firebase service account keys to version control
- Always validate and sanitize user input
- Ensure proper CORS headers are set if accessing from different domains
- Only public profiles return data; private profiles are protected

## Support

For issues or questions, please refer to the main repository documentation.
