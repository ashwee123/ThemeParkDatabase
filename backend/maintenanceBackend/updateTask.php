<?php
include '../dbConnect.php';

$taskID = $_POST['MaintenanceAssignmentID'];
$newStatus = $_POST['Status']; // If this is 'Completed', your DB Trigger fires!

$sql = "UPDATE maintenanceassignment SET Status = ? WHERE MaintenanceAssignmentID = ?";
$stmt = $con->prepare($sql);
$stmt->bind_param("si", $newStatus, $taskID);

if ($stmt->execute()) {
    echo "Status updated!";
}
?>