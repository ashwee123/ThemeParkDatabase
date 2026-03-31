<?php
$host = "127.0.0.1";
$user = "root";
$pass = "";
$db = "themepark";
$port = 3307; // IMPORTANT (your fix earlier)

$conn = new mysqli($host, $user, $pass, $db, $port);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>