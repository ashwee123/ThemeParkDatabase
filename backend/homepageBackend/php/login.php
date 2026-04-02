<?php
header("Content-Type: application/json");
include "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$email = $data["email"];
$password = $data["password"];

// check employees table
$sql = "SELECT * FROM employees WHERE Email = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $email);
$stmt->execute();

$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {

    if ($password === $user["Password"]) {

        echo json_encode([
            "success" => true,
            "role" => $user["Role"]
        ]);

    } else {
        echo json_encode(["success" => false]);
    }

} else {
    echo json_encode(["success" => false]);
}
?>