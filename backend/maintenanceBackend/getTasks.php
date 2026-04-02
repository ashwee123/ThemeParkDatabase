<?php
header('Content-Type: application/json');

// '../' moves up one directory from maintenanceBackend to backend
include '../dbConnect.php'; 

// Check if connection exists
if (!$conn) {
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

$sql = "SELECT 
            m.MaintenanceAssignmentID, 
            e.Name AS EmployeeName, 
            a.AreaName, 
            m.TaskDescription, 
            m.Status, 
            m.DueDate 
        FROM maintenanceassignment m
        LEFT JOIN employee e ON m.EmployeeID = e.EmployeeID
        LEFT JOIN area a ON m.AreaID = a.AreaID";

$result = $conn->query($sql);
$data = [];

if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
}

echo json_encode($data);
$conn->close();
?>