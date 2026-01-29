<?php
/**
 * UTN Tracker - Public API Stats Endpoint (PHP)
 * 
 * This endpoint returns user statistics and profile data in JSON format.
 * Requires a 'uid' GET parameter.
 * 
 * Usage: stats.php?uid=<USER_ID>
 */

// Set headers for JSON response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Include Composer autoload if Firebase Admin SDK is installed
// Uncomment if using Firebase Admin SDK
// require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Calculate statistics from subject data
 * 
 * @param array $subjectData User's subject data
 * @param array|null $planData Plan configuration data
 * @return array Statistics object
 */
function calculateStats($subjectData, $planData) {
    $stats = [
        'totalSubjects' => 0,
        'approvedSubjects' => 0,
        'promotedSubjects' => 0,
        'regularizedSubjects' => 0,
        'inProgressSubjects' => 0,
        'weeklyHours' => 0,
        'averageGrade' => 0,
    ];
    
    $grades = [];
    
    // If no subject data, return default stats
    if (empty($subjectData)) {
        return $stats;
    }
    
    // Count subjects from plan
    if (!empty($planData['modules'])) {
        foreach ($planData['modules'] as $module) {
            if (!empty($module['subjects']) && is_array($module['subjects'])) {
                $stats['totalSubjects'] += count($module['subjects']);
            }
        }
    }
    
    // Calculate stats from subject data
    foreach ($subjectData as $code => $data) {
        if (empty($data)) {
            continue;
        }
        
        $status = $data['overrideStatus'] ?? $data['status'] ?? '';
        
        // Count by status
        if ($status === 'Aprobada') {
            $stats['approvedSubjects']++;
            
            // Extract grade for approved subjects
            if (!empty($data['values'])) {
                // Check for final exam grade
                for ($i = 1; $i <= 4; $i++) {
                    $finalKey = 'final' . $i;
                    if (!empty($data['values'][$finalKey])) {
                        $grade = floatval(str_replace(',', '.', $data['values'][$finalKey]));
                        if (!is_nan($grade) && $grade >= 6) {
                            $grades[] = $grade;
                            break;
                        }
                    }
                }
            }
        } elseif ($status === 'Promocionada') {
            $stats['promotedSubjects']++;
            
            // Extract grade for promoted subjects (average of parciales)
            if (!empty($data['values'])) {
                $p1 = null;
                $p2 = null;
                
                // Get best parcial values
                for ($i = 3; $i >= 1; $i--) {
                    $v = $data['values']['parcial1_' . $i] ?? null;
                    if ($v !== null) {
                        $n = floatval(str_replace(',', '.', strval($v)));
                        if (!is_nan($n)) {
                            $p1 = $n;
                            break;
                        }
                    }
                }
                
                for ($i = 3; $i >= 1; $i--) {
                    $v = $data['values']['parcial2_' . $i] ?? null;
                    if ($v !== null) {
                        $n = floatval(str_replace(',', '.', strval($v)));
                        if (!is_nan($n)) {
                            $p2 = $n;
                            break;
                        }
                    }
                }
                
                if ($p1 !== null && $p2 !== null) {
                    $grades[] = round(($p1 + $p2) / 2);
                }
            }
        } elseif ($status === 'Regularizada') {
            $stats['regularizedSubjects']++;
        } elseif ($status === 'Faltan notas' || $status === 'Faltan examenes') {
            $stats['inProgressSubjects']++;
            
            // For in-progress subjects, count weekly hours
            if (!empty($planData['modules'])) {
                foreach ($planData['modules'] as $module) {
                    if (!empty($module['subjects'])) {
                        foreach ($module['subjects'] as $subject) {
                            if ($subject['code'] === $code && !empty($subject['weekHours'])) {
                                $stats['weeklyHours'] += $subject['weekHours'];
                                break 2;
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Calculate average grade
    if (count($grades) > 0) {
        $sum = array_sum($grades);
        $stats['averageGrade'] = round($sum / count($grades), 2);
    }
    
    return $stats;
}

/**
 * Load plan data from JSON file
 * 
 * @param string $planName Plan name (e.g., 'k23')
 * @return array|null Plan data or null if not found
 */
function loadPlanData($planName) {
    if ($planName === null || $planName === '') {
        return null;
    }
    
    // Whitelist of allowed plan names for security
    $allowedPlans = ['k23', 'k23medio'];
    if (!in_array($planName, $allowedPlans, true)) {
        return null;
    }
    
    $planPath = __DIR__ . '/../assets/data/' . $planName . '.json';
    
    if (!file_exists($planPath)) {
        return null;
    }
    
    $jsonContent = file_get_contents($planPath);
    $planData = json_decode($jsonContent, true);
    
    // Check for JSON parsing errors
    if ($planData === null && json_last_error() !== JSON_ERROR_NONE) {
        error_log('JSON parsing error in plan file: ' . json_last_error_msg());
        return null;
    }
    
    return $planData;
}

/**
 * Simulate Firebase Firestore connection
 * In a real implementation, this would connect to Firebase using the Admin SDK
 * For now, this returns mock data or reads from a local JSON file if available
 * 
 * @param string $uid User ID
 * @return array|null User data or null if not found
 */
function getUserDataFromFirestore($uid) {
    // NOTE: This is a placeholder implementation
    // In production, you would use Firebase Admin SDK for PHP:
    /*
    use Kreait\Firebase\Factory;
    
    $factory = (new Factory)
        ->withServiceAccount(__DIR__ . '/path/to/service-account-key.json');
    
    $firestore = $factory->createFirestore();
    $database = $firestore->database();
    
    $docRef = $database->collection('users')->document($uid);
    $snapshot = $docRef->snapshot();
    
    if (!$snapshot->exists()) {
        return null;
    }
    
    return $snapshot->data();
    */
    
    // For development/testing: Check if there's a test data file
    // Validate uid format for security (alphanumeric, underscore, hyphen only)
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $uid)) {
        return null;
    }
    
    $testDataPath = __DIR__ . '/test-data/' . $uid . '.json';
    if (file_exists($testDataPath)) {
        $jsonContent = file_get_contents($testDataPath);
        $userData = json_decode($jsonContent, true);
        
        // Check for JSON parsing errors
        if ($userData === null && json_last_error() !== JSON_ERROR_NONE) {
            error_log('JSON parsing error in user data file: ' . json_last_error_msg());
            return null;
        }
        
        return $userData;
    }
    
    // Return null if user not found
    return null;
}

// Main execution
try {
    // Get uid from GET parameter
    $uid = $_GET['uid'] ?? null;
    
    // Validate uid parameter
    if (!isset($_GET['uid']) || trim($_GET['uid']) === '') {
        http_response_code(400);
        echo json_encode([
            'error' => 'Missing uid parameter',
            'message' => 'Please provide a uid parameter in the URL'
        ], JSON_PRETTY_PRINT);
        exit;
    }
    
    $uid = trim($_GET['uid']);
    
    // Fetch user data from Firestore
    $userData = getUserDataFromFirestore($uid);
    
    if ($userData === null) {
        http_response_code(404);
        echo json_encode([
            'error' => 'User not found',
            'message' => 'This profile does not exist'
        ], JSON_PRETTY_PRINT);
        exit;
    }
    
    // Check if profile is public
    if (!isset($userData['public']) || $userData['public'] !== true) {
        http_response_code(403);
        echo json_encode([
            'error' => 'Private profile',
            'message' => 'This profile is not public'
        ], JSON_PRETTY_PRINT);
        exit;
    }
    
    // Load plan data if available
    $planData = null;
    if (!empty($userData['plan'])) {
        $planData = loadPlanData($userData['plan']);
    }
    
    // Calculate statistics
    $subjectData = $userData['subjectData'] ?? [];
    $stats = calculateStats($subjectData, $planData);
    
    // Prepare response
    $response = [
        'uid' => $uid,
        'plan' => $userData['plan'] ?? null,
        'yearStarted' => $userData['yearStarted'] ?? null,
        'subjectData' => $subjectData,
        'electives' => $userData['electives'] ?? (object)[],
        'selectedStats' => $userData['selectedStats'] ?? [],
        'stats' => $stats,
        'public' => true
    ];
    
    // Return JSON response with 200 OK
    http_response_code(200);
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    // Handle any errors
    error_log('API error: ' . $e->getMessage() . ' - ' . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => 'Error loading profile data'
    ], JSON_PRETTY_PRINT);
}
