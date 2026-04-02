<?php
header('Content-Type: application/json');

// 1. Point to your connection file
require_once '../dbConnect.php'; 

// 2. Bridge the variable names (Checks both common versions)
if (!isset($con) && isset($conn)) {
    $con = $conn;
}

// 3. Safety check - stop the crash if connection failed
if (!isset($con)) {
    echo json_encode(["error" => "Database connection variable not found."]);
    exit;
}

// 4. Fetch the data
$query = "SELECT AttractionID, AttractionName, Status FROM attraction";
$result = $con->query($query);

$attractions = [];

if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $attractions[] = $row;
    }
}

// 5. Output CLEAN Json
echo json_encode($attractions);
?>