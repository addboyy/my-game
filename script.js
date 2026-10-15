const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

// ===== 좌표와 크기 (여기 숫자만 바꾸면 그림이 바뀐다) =====
// 화면 크기: 가로 800, 세로 600. (0, 0)은 왼쪽 위, y가 커지면 아래로 간다.

// 복도: 양쪽 벽 두께와 바닥 타일 크기
const WALL_WIDTH = 100;   // 왼쪽·오른쪽 벽 두께
const TILE_SIZE = 50;     // 바닥 타일 한 칸 크기

// 플레이어(의자): 파란 사각형 32×32, 화면 중간 아래부분
const CHAIR_X = 384;      // 왼쪽 위 꼭짓점 x
const CHAIR_Y = 500;      // 왼쪽 위 꼭짓점 y
const CHAIR_SIZE = 32;

// 다른 학생: 초록 원 반지름 15 (원의 x, y는 "중심")
const STUDENT_RADIUS = 15;
const STUDENTS = [
  { x: 250, y: 330 },
  { x: 520, y: 240 },
  { x: 420, y: 160 },
];

// 자동차: 빨간 직사각형 40×70
const CAR_X = 560;
const CAR_Y = 360;
const CAR_WIDTH = 40;
const CAR_HEIGHT = 70;

// 강의실 문: 노란 사각형 + "강의실" 글자 (맵 맨 위 끝)
const DOOR_X = 340;
const DOOR_Y = 60;
const DOOR_WIDTH = 120;
const DOOR_HEIGHT = 40;

// 남은 시간 글자: 화면 위 가운데
const TIME_LEFT = 60;     // 아직 줄어들지 않는다 (4주차에 1초씩 줄어들게 만든다)

// 부스터 게이지: 화면 아래 가운데
const GAUGE_X = 300;
const GAUGE_Y = 570;
const GAUGE_WIDTH = 200;
const GAUGE_HEIGHT = 14;
const GAUGE_FILL = 0.4;   // 0 = 비어 있음, 1 = 가득 참

// ===== 1. 배경: 위에서 내려다본 복도 =====

// 바닥 전체를 밝은 회색으로 칠한다
ctx.fillStyle = "#c9c9c9";
ctx.fillRect(0, 0, 800, 600);

// 바닥 타일 줄무늬: 가로줄과 세로줄을 TILE_SIZE 간격으로 긋는다
ctx.strokeStyle = "#b3b3b3";
ctx.lineWidth = 1;
for (let y = 0; y <= 600; y += TILE_SIZE) {
  ctx.beginPath();
  ctx.moveTo(WALL_WIDTH, y);
  ctx.lineTo(800 - WALL_WIDTH, y);
  ctx.stroke();
}
for (let x = WALL_WIDTH; x <= 800 - WALL_WIDTH; x += TILE_SIZE) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, 600);
  ctx.stroke();
}

// 양쪽 벽: 진한 회색 사각형
ctx.fillStyle = "#4a4a4a";
ctx.fillRect(0, 0, WALL_WIDTH, 600);                  // 왼쪽 벽
ctx.fillRect(800 - WALL_WIDTH, 0, WALL_WIDTH, 600);   // 오른쪽 벽

// ===== 2. 강의실 문 (도착 지점) =====

// [새로 시도] 그라데이션: 위는 진한 노랑, 아래는 밝은 노랑
const doorGradient = ctx.createLinearGradient(0, DOOR_Y, 0, DOOR_Y + DOOR_HEIGHT);
doorGradient.addColorStop(0, "#e6b800");
doorGradient.addColorStop(1, "#ffe066");
ctx.fillStyle = doorGradient;
ctx.fillRect(DOOR_X, DOOR_Y, DOOR_WIDTH, DOOR_HEIGHT);

// 문 위에 "강의실" 글자
ctx.fillStyle = "#333333";
ctx.font = "bold 20px sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("강의실", DOOR_X + DOOR_WIDTH / 2, DOOR_Y + DOOR_HEIGHT / 2);

// ===== 3. 다른 학생들 (초록 원) =====

for (const student of STUDENTS) {
  // [새로 시도] 반투명 그림자: 원을 오른쪽 아래로 조금 비켜서 먼저 그린다
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.arc(student.x + 3, student.y + 3, STUDENT_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // 학생 본체
  ctx.fillStyle = "#2e9e4f";
  ctx.beginPath();
  ctx.arc(student.x, student.y, STUDENT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

// ===== 4. 자동차 (빨간 직사각형) =====

// 반투명 그림자
ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
ctx.fillRect(CAR_X + 4, CAR_Y + 4, CAR_WIDTH, CAR_HEIGHT);

// 자동차 본체
ctx.fillStyle = "#d62828";
ctx.fillRect(CAR_X, CAR_Y, CAR_WIDTH, CAR_HEIGHT);

// 앞유리 (위쪽이 앞): 본체 위에 하늘색 사각형을 겹쳐 그린다
ctx.fillStyle = "#a8dadc";
ctx.fillRect(CAR_X + 6, CAR_Y + 10, CAR_WIDTH - 12, 14);

// ===== 5. 플레이어 의자 (파란 사각형) =====

// 반투명 그림자
ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
ctx.fillRect(CHAIR_X + 3, CHAIR_Y + 3, CHAIR_SIZE, CHAIR_SIZE);

// 의자 본체
ctx.fillStyle = "#1e6fd9";
ctx.fillRect(CHAIR_X, CHAIR_Y, CHAIR_SIZE, CHAIR_SIZE);

// ===== 6. 글자: 남은 시간 (화면 위 가운데) =====

// 글자가 잘 보이게 뒤에 반투명 검은 띠를 깐다
ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
ctx.fillRect(310, 10, 180, 36);

ctx.fillStyle = "#ffffff";
ctx.font = "bold 24px sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("남은 시간 " + TIME_LEFT + "초", 400, 28);

// ===== 7. 부스터 게이지 (화면 아래 가운데) =====

// 게이지 뒤 반투명 검은 띠
ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
ctx.fillRect(GAUGE_X - 10, GAUGE_Y - 26, GAUGE_WIDTH + 20, GAUGE_HEIGHT + 34);

// 게이지 이름
ctx.fillStyle = "#ffffff";
ctx.font = "14px sans-serif";
ctx.fillText("부스터", 400, GAUGE_Y - 14);

// 빈 칸: 어두운 막대
ctx.fillStyle = "#333333";
ctx.fillRect(GAUGE_X, GAUGE_Y, GAUGE_WIDTH, GAUGE_HEIGHT);

// 찬 칸: 주황 막대 (가로 길이 = 전체 길이 × 찬 비율)
ctx.fillStyle = "#ff9f1c";
ctx.fillRect(GAUGE_X, GAUGE_Y, GAUGE_WIDTH * GAUGE_FILL, GAUGE_HEIGHT);

// 게이지 테두리
ctx.strokeStyle = "#ffffff";
ctx.strokeRect(GAUGE_X, GAUGE_Y, GAUGE_WIDTH, GAUGE_HEIGHT);
