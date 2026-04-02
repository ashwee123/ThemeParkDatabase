<?php
include '../dbConnect.php';
ob_clean();

$areaID = $_GET['AreaID']; // Pass this in the URL like ?AreaID=200

$sql = "SELECT ma.*, att.AttractionName 
        FROM maintenanceassignment ma
        JOIN attraction att ON ma.AreaID = att.AreaID
        WHERE ma.AreaID = ?";

$stmt = $con->prepare($sql);
$stmt->bind_param("i", $areaID);
$stmt->execute();
$result = $stmt->get_result();

$tasks = [];
while($row = $result->fetch_assoc()) {
    $tasks[] = $row;
}

header('Content-Type: application/json');
echo json_encode($tasks);
?>