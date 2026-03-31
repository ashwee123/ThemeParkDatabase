<?php
header("Content-Type: application/json");
include "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$email = $data["email"];
$password = $data["password"];

// Example: using employees table
$sql = "SELECT * FROM employees WHERE email = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $email);
$stmt->execute();

$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {

    // ⚠️ TEMP: plain text password (for now)
    if ($password === $user["password"]) {

        echo json_encode([
            "success" => true,
            "role" => "staff"
        ]);

    } else {
        echo json_encode(["success" => false]);
    }

} else {
    echo json_encode(["success" => false]);
}
?>