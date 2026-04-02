<?php
include '../dbConnect.php';

$empID = $_POST['EmployeeID'];
$areaID = $_POST['AreaID'];
$desc = $_POST['TaskDescription'];
$status = $_POST['Status']; // e.g., 'Pending'
$date = $_POST['DueDate'];

$sql = "INSERT INTO maintenanceassignment (EmployeeID, AreaID, TaskDescription, Status, DueDate) 
        VALUES (?, ?, ?, ?, ?)";

$stmt = $con->prepare($sql);
$stmt->bind_param("iisss", $empID, $areaID, $desc, $status, $date);

if ($stmt->execute()) {
    echo "Task assigned successfully!";
} else {
    echo "Error: " . $con->error;
}
?>