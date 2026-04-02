<?php
$host = "themepark6.mysql.database.azure.com";
$user = "admin1";
$password = "uma1uma2uma!";
$database = "newthemepark";

$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>