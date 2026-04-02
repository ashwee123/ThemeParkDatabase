<?php
// REMOVED: require_once 'dbConnect.php'; (This was causing a loop)

$host = 'themepark6.mysql.database.azure.com';
$username = 'admin1';
$password = 'uma1uma2uma!'; 
$database = 'newthemepark';
$port = 3306;

// Changed $con to $conn to match your getTasks.php
$conn = mysqli_init();

$ssl_ca = 'C:/xampp/php/extras/ssl/cacert.pem';

if (!file_exists($ssl_ca)) {
    die("SSL Certificate not found at: " . $ssl_ca);
}

mysqli_ssl_set($conn, NULL, NULL, $ssl_ca, NULL, NULL);

$result = mysqli_real_connect(
    $conn, 
    $host, 
    $username, 
    $password, 
    $database, 
    $port, 
    NULL, 
    MYSQLI_CLIENT_SSL
);

if (!$result) {
    die("Connection failed: " . mysqli_connect_error());
}
?>