<?php
$host = "127.0.0.1";
$user = "root";
$pass = "";
$db = "newthemepark";
$port = 3307;

$conn = new mysqli($host, $user, $pass, $db, $port);

if ($conn->connect_error) {
    header("Content-Type: application/json");
    echo json_encode(["success" => false, "message" => "Remote DB Error: " . $conn->connect_error]);
    exit;
}
?>