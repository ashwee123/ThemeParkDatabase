<?php
include '../dbConnect.php';

$attractionID = $_POST['AttractionID'];

// We use a prepared statement for security
$sql = "DELETE FROM attraction WHERE AttractionID = ?";
$stmt = $con->prepare($sql);
$stmt->bind_param("i", $attractionID);

if ($stmt->execute()) {
    echo "Attraction removed from registry.";
} else {
    echo "Error: Could not delete. (Check for active maintenance tasks first)";
}
?>