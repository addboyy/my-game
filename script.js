const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

// ===== 좌표와 크기 (여기 숫자만 바꾸면 그림이 바뀐다) =====
// 화면 크기: 가로 800, 세로 600. (0, 0)은 왼쪽 위, y가 커지면 아래로 간다.

// ===== 맵과 카메라 (스크롤) =====
// 맵은 화면보다 세로로 길다. 아래 좌표들은 전부 "맵 위의 좌표"다 (맵 맨 위 = 0, 강의실이 있는 곳).
// 화면은 맵의 일부만 비추는 카메라이고, 의자가 위로 가면 카메라도 따라 올라간다.
const SCREEN_HEIGHT = 600;
const WORLD_HEIGHT = SCREEN_HEIGHT * 3;     // 맵 전체 세로 길이 (화면 3장 = 1800)
const CAMERA_FOLLOW_Y = 380;                // 스크롤 중에 의자가 머무르는 화면 속 높이
let cameraY = WORLD_HEIGHT - SCREEN_HEIGHT; // 카메라가 비추는 맨 위의 맵 y (처음엔 맵 맨 아래 화면)

// 캠퍼스 도로: 왼쪽부터 잔디 → 인도 → 차도 → 인도 → 잔디
const GRASS_WIDTH = 90;       // 양쪽 잔디 폭
const SIDEWALK_WIDTH = 40;    // 양쪽 인도 폭
const ROAD_LEFT = GRASS_WIDTH + SIDEWALK_WIDTH;   // 차도 왼쪽 끝 x (130)
const ROAD_RIGHT = 800 - ROAD_LEFT;               // 차도 오른쪽 끝 x (670)

// 강의실 건물: 화면 맨 위 (맵 맨 위 끝)
const BUILDING_HEIGHT = 100;

// 횡단보도: 건물 바로 앞
const CROSSWALK_Y = 120;
const CROSSWALK_HEIGHT = 40;

// 나무: 잔디 위 (이미지의 왼쪽 위 꼭짓점 좌표). 나무와 풀은 화면 한 장 분량을 맵 전체에 반복해서 그린다
const TREE_SIZE = 80;
const TREES = [
  { x: 5, y: 130 },
  { x: 5, y: 330 },
  { x: 715, y: 230 },
  { x: 715, y: 450 },
];

// 풀 포기: 잔디 위에 바람에 흔들리는 풀잎 묶음 (x, y는 풀 뿌리 위치)
const GRASS_TUFTS = [
  { x: 25, y: 125 }, { x: 65, y: 240 }, { x: 20, y: 300 }, { x: 70, y: 450 },
  { x: 30, y: 520 }, { x: 65, y: 590 }, { x: 45, y: 280 }, { x: 15, y: 590 },
  { x: 740, y: 140 }, { x: 780, y: 200 }, { x: 735, y: 360 }, { x: 775, y: 410 },
  { x: 750, y: 570 }, { x: 785, y: 595 }, { x: 725, y: 215 }, { x: 790, y: 330 },
];
const GRASS_BLADE_HEIGHT = 18;   // 풀잎 길이
const GRASS_SWAY = 4;            // 풀잎 끝이 좌우로 흔들리는 최대 거리
let swayTime = 0;                // 흔들림 시계: 매 프레임 조금씩 커진다
const SWAY_SPEED = 0.05;         // 흔들리는 빠르기 (클수록 빨리 흔들린다)
const TREE_SWAY_ANGLE = 0.04;    // 나무가 좌우로 기우는 최대 각도 (0.04 ≈ 2도)

// 구름 그림자: 하늘의 구름이 땅에 드리운 반투명 그림자가 천천히 가로지른다
// x가 매 프레임 바뀌므로 let. size는 크기 배율 (1 = 기본)
let clouds = [
  { x: -100, y: 260, speedX: 0.4, size: 1 },
  { x: 500, y: 470, speedX: 0.25, size: 0.8 },
  { x: 150, y: 900, speedX: 0.3, size: 0.9 },
  { x: 600, y: 1300, speedX: 0.35, size: 1 },
  { x: -50, y: 1550, speedX: 0.2, size: 0.7 },
];
const CLOUD_RADIUS = 110;        // 구름 그림자 가로 반지름 (size가 1일 때)

// 플레이어(의자): 50×50, 맵 맨 아래 화면의 중간 아래부분에서 출발한다
// 방향키로 움직이므로 위치는 let (chairX, chairY는 왼쪽 위 꼭짓점)
const CHAIR_SIZE = 50;
let chairX = 375;
let chairY = WORLD_HEIGHT - 110;

// ===== 조작 설정 (여기 숫자를 바꿔 가며 조작 느낌을 튜닝한다) =====
const CHAIR_SPEED = 5;        // 이동 속도: 한 프레임에 움직이는 픽셀 수 (최고 속도)
const GRIP = 0.25;            // 평소 접지력 (0~1): 클수록 키를 누른 방향으로 바로 꺾이고 바로 선다
const DRIFT_GRIP = 0.03;      // Shift 드리프트 중 접지력: 작을수록 관성이 커서 옆으로 오래 미끄러진다
const TURN_SPEED = 0.2;       // 의자가 가는 방향으로 몸을 돌리는 빠르기 (0~1)

let chairVX = 0;              // 의자의 지금 가로 속도 (양수 = 오른쪽)
let chairVY = 0;              // 의자의 지금 세로 속도 (양수 = 아래)
let chairAngle = 0;           // 의자가 바라보는 방향 (0 = 위쪽, 단위는 라디안)

// 조작 방식 비교 실험용 스위치 (워크북 5장 Step 2 · Step 3)
// "A" = keydown 안에서 직접 움직이는 방식 (꾹 누르면 끊기고, 대각선이 안 된다)
// "B" = keys에 눌린 상태를 기록하고, 게임 루프에서 움직이는 방식 (매끄럽다)
const CONTROL_METHOD = "B";

// 눌린 키를 적어 두는 메모장: keys["ArrowLeft"]가 true면 지금 왼쪽 키가 눌려 있다
const keys = {};

// 다른 학생: 위에서 본 초록 옷 학생 (x, y는 "중심")
const STUDENT_WIDTH = 52;
const STUDENT_HEIGHT = 36;
// 학생들은 두 자동차 차선 사이에서만 좌우로 천천히 걷다가, 차선에 닿기 전에 돌아선다
// x가 매 프레임 바뀌므로 let. speedX는 한 프레임에 가로로 걷는 양 (양수 = 오른쪽)
let students = [
  { x: 280, y: 330, speedX: 1 },
  { x: 520, y: 240, speedX: -0.7 },
  { x: 420, y: 200, speedX: 0.5 },
  { x: 350, y: 720, speedX: 0.8 },
  { x: 480, y: 960, speedX: -1 },
  { x: 300, y: 1180, speedX: 0.6 },
  { x: 450, y: 1420, speedX: -0.5 },
];

// 자동차: 40×70, 오른쪽 차선을 따라 아래로 내려간다
const CAR_X = 590;        // 차선 위치 (가로는 움직이지 않는다)
const CAR_WIDTH = 40;
const CAR_HEIGHT = 70;
let carY = WORLD_HEIGHT - 300;   // 자동차의 세로 위치 (매 프레임 바뀐다)
let carSpeedY = 6;        // 한 프레임에 아래로 6씩 (양수 = 아래, 음수 = 위)

// 자동차 2: 왼쪽 차선을 따라 위로 올라간다 (반대 방향, 다른 속도)
const CAR2_X = 170;       // 왼쪽 차선 위치 (오른쪽 자동차와 대칭)
let car2Y = WORLD_HEIGHT - 150;  // 자동차 2의 세로 위치
let car2SpeedY = -4;      // 한 프레임에 위로 4씩 (음수 = 위)

// 학생이 걸어 다닐 수 있는 구역: 왼쪽 자동차 차선 오른쪽 ~ 오른쪽 자동차 차선 왼쪽
// 자동차와 15픽셀 여유를 두어서 학생과 자동차가 절대 겹치지 않는다
const WALK_LEFT = CAR2_X + CAR_WIDTH + 15;    // 225
const WALK_RIGHT = CAR_X - 15;                // 575
const STUDENT_WOBBLE = 0.12;  // 걸을 때 몸이 좌우로 흔들리는 각도 (0.12 ≈ 7도)

// 자동차 전조등: 자동차 앞쪽으로 뻗는 노란 반투명 빛
const HEADLIGHT_LENGTH = 45;  // 빛이 뻗는 길이

// 강의실 문: 노란 사각형 + "강의실" 글자 (건물 아래쪽에 붙어 있다)
const DOOR_X = 340;
const DOOR_Y = 60;
const DOOR_WIDTH = 120;
const DOOR_HEIGHT = 40;

// 남은 시간 글자: 화면 위 가운데
let timeLeft = 60;        // 남은 시간(초). 1초마다 1씩 줄어든다
let lastSecondTime = 0;   // 마지막으로 1초를 줄인 시각 (Date.now() 값, 밀리초)

// 부스터 게이지: 화면 아래 가운데
const GAUGE_X = 300;
const GAUGE_Y = 570;
const GAUGE_WIDTH = 200;
const GAUGE_HEIGHT = 14;
const GAUGE_FILL = 0.4;   // 0 = 비어 있음, 1 = 가득 참

// ===== 이미지 불러오기 =====
// 이미지는 불러오는 데 시간이 걸린다.
// 모든 이미지가 다 불러와진 뒤(onload)에 화면을 그려야 빈칸 없이 보인다.

const chairImage = new Image();
const carImage = new Image();
const studentImage = new Image();
const treeImage = new Image();
const grassImage = new Image();

const allImages = [chairImage, carImage, studentImage, treeImage, grassImage];
let loadedCount = 0;     // 지금까지 불러온 이미지 개수

for (const image of allImages) {
  image.onload = function () {
    loadedCount = loadedCount + 1;
    // 마지막 이미지까지 다 불러왔으면 게임 루프에 시동을 건다
    if (loadedCount === allImages.length) {
      lastSecondTime = Date.now();   // 시간 재기 시작
      gameLoop();                    // 첫 시동 (그 뒤로는 루프가 스스로 자기를 부른다)
    }
  };
}

// src를 정하는 순간 불러오기가 시작된다 (파일 이름은 영어 소문자)
chairImage.src = "images/chair.svg";
carImage.src = "images/car.png";
studentImage.src = "images/student.png";
treeImage.src = "images/tree.png";
grassImage.src = "images/grass.png";

// ===== 키보드 입력 =====
// 키보드는 canvas가 아니라 document(페이지 전체)에 건다. canvas는 키 입력을 받지 않는다.

// 키를 누르는 순간: "눌렸다"고 적어 둔다
document.addEventListener("keydown", function (e) {
  // 방향키·스페이스바로 페이지가 스크롤되어 게임이 흔들리지 않게, 브라우저 기본 동작을 막는다
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }

  if (CONTROL_METHOD === "A") {
    // 방식 A: 눌릴 때마다 여기서 바로 위치를 바꾼다 (비교 실험용)
    if (e.key === "ArrowLeft") chairX = chairX - CHAIR_SPEED;
    if (e.key === "ArrowRight") chairX = chairX + CHAIR_SPEED;
    if (e.key === "ArrowUp") chairY = chairY - CHAIR_SPEED;
    if (e.key === "ArrowDown") chairY = chairY + CHAIR_SPEED;
  } else {
    // 방식 B: 기록만 한다. 실제로 움직이는 건 게임 루프가 한다
    keys[e.key] = true;
  }
});

// 키에서 손을 떼는 순간: "떼었다"고 적어 둔다
document.addEventListener("keyup", function (e) {
  keys[e.key] = false;
});

// 다른 창을 누르면 keyup이 안 들어와서 키가 계속 눌린 걸로 남는다 → 전부 뗀 것으로 지운다
window.addEventListener("blur", function () {
  for (const key in keys) {
    keys[key] = false;
  }
});

// ===== 게임 루프: 지우기 → 계산 → 그리기 → 다음 프레임 예약 =====

function gameLoop() {
  // ===== ① 지우기: 이전 프레임 그림을 없앤다 =====
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ===== ② 계산: 상태(숫자)를 바꾼다 =====

  // 의자 조작 (방식 B): 지금 눌려 있는 키를 보고 움직인다
  if (CONTROL_METHOD === "B") {
    // 1) 눌린 방향키로 "가고 싶은 방향"을 정한다 (-1, 0, 1)
    //    두 키를 같이 누르면 두 줄이 다 실행되므로 대각선이 된다
    let moveX = 0;
    let moveY = 0;
    if (keys["ArrowLeft"]) moveX = moveX - 1;
    if (keys["ArrowRight"]) moveX = moveX + 1;
    if (keys["ArrowUp"]) moveY = moveY - 1;
    if (keys["ArrowDown"]) moveY = moveY + 1;

    // 2) Shift를 누르고 있으면 드리프트: 접지력이 약해져서 미끄러진다
    let grip = GRIP;
    if (keys["Shift"]) {
      grip = DRIFT_GRIP;
    }

    // 3) 지금 속도가 목표 속도(방향 × 최고 속도)를 grip 비율만큼만 따라간다
    //    grip이 크면 금방 따라가서 바로 꺾이고, 작으면 원래 가던 쪽으로 계속 미끄러진다 (관성)
    chairVX = chairVX + (moveX * CHAIR_SPEED - chairVX) * grip;
    chairVY = chairVY + (moveY * CHAIR_SPEED - chairVY) * grip;

    // 4) 속도만큼 위치를 옮긴다
    chairX = chairX + chairVX;
    chairY = chairY + chairVY;

    // 5) 의자가 방향키 쪽을 바라보게 조금씩 돌린다
    //    드리프트 중에는 몸은 먼저 돌아가고 몸통은 옆으로 미끄러져서 드리프트처럼 보인다
    if (moveX !== 0 || moveY !== 0) {
      const targetAngle = Math.atan2(moveX, -moveY);           // 방향키 쪽 각도 (위 = 0)
      let diff = targetAngle - chairAngle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));       // 더 가까운 쪽으로 돌게 -180~180도로 맞춘다
      chairAngle = chairAngle + diff * TURN_SPEED;
    }
  }

  // 의자가 화면 밖으로 나가지 않게 네 벽에서 막는다 (벽에 닿으면 그 방향 속도는 0)
  // 오른쪽·아래쪽은 의자 크기를 뺀다 (chairX는 왼쪽 위 꼭짓점이라, 빼지 않으면 반쯤 박힌다)
  // 위쪽 벽은 강의실 건물 아래 끝이다 (건물 안으로는 못 들어간다)
  if (chairX < 0) {
    chairX = 0;
    chairVX = 0;
  }
  if (chairX > canvas.width - CHAIR_SIZE) {
    chairX = canvas.width - CHAIR_SIZE;
    chairVX = 0;
  }
  if (chairY < BUILDING_HEIGHT) {
    chairY = BUILDING_HEIGHT;
    chairVY = 0;
  }
  if (chairY > WORLD_HEIGHT - CHAIR_SIZE) {
    chairY = WORLD_HEIGHT - CHAIR_SIZE;
    chairVY = 0;
  }

  // 카메라가 의자를 따라간다: 의자가 화면 속 CAMERA_FOLLOW_Y 높이에 오게 맞춘다
  // 단, 맵 맨 위보다 위나 맵 맨 아래보다 아래는 비추지 않는다
  cameraY = chairY - CAMERA_FOLLOW_Y;
  if (cameraY < 0) cameraY = 0;
  if (cameraY > WORLD_HEIGHT - SCREEN_HEIGHT) cameraY = WORLD_HEIGHT - SCREEN_HEIGHT;

  // 자동차를 속도만큼 아래로 옮긴다
  carY = carY + carSpeedY;

  // 지금 화면(카메라) 아래로 완전히 사라지면, 화면 바로 위에서 다시 나타난다
  // 맵 맨 위에서는 건물 뒤에서 나오는 것처럼 보인다
  if (carY > cameraY + SCREEN_HEIGHT) {
    carY = cameraY - CAR_HEIGHT;
  }

  // 흔들림 시계를 조금 앞으로 돌린다 (풀잎 흔들림에 쓴다)
  swayTime = swayTime + SWAY_SPEED;

  // 자동차 2를 속도만큼 위로 옮긴다 (속도가 음수라 y가 줄어든다)
  car2Y = car2Y + car2SpeedY;

  // 지금 화면(카메라) 위로 완전히 사라지면, 화면 바로 아래에서 다시 나타난다
  if (car2Y + CAR_HEIGHT < cameraY) {
    car2Y = cameraY + SCREEN_HEIGHT;
  }

  // 학생들을 걷는 속도만큼 옮기고, 걷는 구역 끝(자동차 차선 앞)에 닿으면 방향을 뒤집는다
  for (const student of students) {
    student.x = student.x + student.speedX;
    if (student.x + STUDENT_WIDTH / 2 > WALK_RIGHT || student.x - STUDENT_WIDTH / 2 < WALK_LEFT) {
      student.speedX = -student.speedX;
    }
  }

  // 구름 그림자를 오른쪽으로 천천히 옮기고, 화면 오른쪽 밖으로 나가면 왼쪽 밖에서 다시 들어온다
  for (const cloud of clouds) {
    cloud.x = cloud.x + cloud.speedX;
    if (cloud.x - CLOUD_RADIUS * cloud.size > canvas.width) {
      cloud.x = -CLOUD_RADIUS * cloud.size;
    }
  }

  // 1초(1000밀리초)가 지났으면 남은 시간을 1 줄인다 (0에서 멈춘다)
  // 프레임 수를 세지 않고 실제 시계로 재므로, 화면이 빠른 기기에서도 똑같이 1초다
  if (Date.now() - lastSecondTime >= 1000 && timeLeft > 0) {
    timeLeft = timeLeft - 1;
    lastSecondTime = lastSecondTime + 1000;
  }

  // ===== ③ 그리기: 바뀐 숫자대로 화면을 그린다 =====

  // 카메라: 맵 전체를 cameraY만큼 위로 밀어 올려서 그린다
  // 그러면 맵 위의 y = cameraY인 곳이 화면 맨 위(0)에 온다.
  // 여기부터 restore 전까지는 전부 "맵 위의 좌표"로 그린다
  ctx.save();
  ctx.translate(0, -cameraY);

  // ----- 1. 잔디 (양쪽) -----
  // [새로 시도] 패턴: 작은 잔디 그림을 타일처럼 반복해서 칠한다
  ctx.fillStyle = ctx.createPattern(grassImage, "repeat");
  ctx.fillRect(0, 0, GRASS_WIDTH, WORLD_HEIGHT);                  // 왼쪽 잔디
  ctx.fillRect(800 - GRASS_WIDTH, 0, GRASS_WIDTH, WORLD_HEIGHT);  // 오른쪽 잔디

  // 풀 포기: 포기마다 풀잎 3개. 끝부분이 sin(사인) 물결처럼 좌우로 흔들린다
  // 포기마다 위치를 더해서 흔들리는 타이밍을 다르게 → 바람이 지나가는 것처럼 보인다
  // 화면 한 장 분량의 풀 배치를 맵 아래쪽으로 화면 높이만큼씩 내려가며 반복한다
  ctx.strokeStyle = "#2f7d32";
  ctx.lineWidth = 2;
  for (let screenTop = 0; screenTop < WORLD_HEIGHT; screenTop += SCREEN_HEIGHT) {
    for (const tuft of GRASS_TUFTS) {
      const tuftY = screenTop + tuft.y;
      const sway = Math.sin(swayTime + tuft.x * 0.05 + tuftY * 0.03) * GRASS_SWAY;
      for (let i = -1; i <= 1; i++) {
        const rootX = tuft.x + i * 4;                        // 풀잎 뿌리 (4픽셀 간격)
        const tipX = rootX + i * 3 + sway;                    // 풀잎 끝 (바깥으로 벌어지고 + 흔들림)
        const tipY = tuftY - GRASS_BLADE_HEIGHT + Math.abs(i) * 3;   // 가운데 잎이 제일 길다
        ctx.beginPath();
        ctx.moveTo(rootX, tuftY);
        ctx.quadraticCurveTo(rootX, tuftY - GRASS_BLADE_HEIGHT / 2, tipX, tipY);   // 살짝 휜 풀잎
        ctx.stroke();
      }
    }
  }

  // ----- 2. 인도 (양쪽): 밝은 회색 + 보도블록 줄 -----
  ctx.fillStyle = "#bfbfbf";
  ctx.fillRect(GRASS_WIDTH, 0, SIDEWALK_WIDTH, WORLD_HEIGHT);     // 왼쪽 인도
  ctx.fillRect(ROAD_RIGHT, 0, SIDEWALK_WIDTH, WORLD_HEIGHT);      // 오른쪽 인도

  ctx.strokeStyle = "#a6a6a6";
  ctx.lineWidth = 1;
  for (let y = 0; y <= WORLD_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(GRASS_WIDTH, y);
    ctx.lineTo(ROAD_LEFT, y);
    ctx.moveTo(ROAD_RIGHT, y);
    ctx.lineTo(800 - GRASS_WIDTH, y);
    ctx.stroke();
  }

  // ----- 3. 차도: 진한 회색 아스팔트 -----
  ctx.fillStyle = "#4d4d4d";
  ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, WORLD_HEIGHT);

  // 차도 양쪽 흰 실선
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(ROAD_LEFT + 6, 0, 4, WORLD_HEIGHT);
  ctx.fillRect(ROAD_RIGHT - 10, 0, 4, WORLD_HEIGHT);

  // 가운데 노란 점선: 횡단보도 아래부터 30 그리고 20 쉬고를 반복
  ctx.fillStyle = "#f2c200";
  for (let y = CROSSWALK_Y + CROSSWALK_HEIGHT + 20; y < WORLD_HEIGHT; y += 50) {
    ctx.fillRect(398, y, 4, 30);
  }

  // ----- 4. 횡단보도: 흰 줄무늬 -----
  ctx.fillStyle = "#ffffff";
  for (let x = ROAD_LEFT + 20; x < ROAD_RIGHT - 20; x += 40) {
    ctx.fillRect(x, CROSSWALK_Y, 20, CROSSWALK_HEIGHT);
  }

  // ----- 5. 나무 (잔디 위): 풀과 같은 흔들림 시계로 살짝 기울었다 돌아온다 -----
  // 풀처럼 화면 한 장 분량의 배치를 맵 전체에 반복한다
  for (let screenTop = 0; screenTop < WORLD_HEIGHT; screenTop += SCREEN_HEIGHT) {
    for (const tree of TREES) {
      const treeY = screenTop + tree.y;
      const angle = Math.sin(swayTime * 0.8 + treeY * 0.02) * TREE_SWAY_ANGLE;
      ctx.save();
      ctx.translate(tree.x + TREE_SIZE / 2, treeY + TREE_SIZE / 2);   // 나무 중심으로 붓을 옮긴다
      ctx.rotate(angle);                                             // 그 자리에서 살짝 돌린다
      ctx.drawImage(treeImage, -TREE_SIZE / 2, -TREE_SIZE / 2, TREE_SIZE, TREE_SIZE);
      ctx.restore();
    }
  }

  // ----- 자동차 전조등 -----
  // 자동차보다 먼저 그려서 빛이 차 밑에서 앞으로 뻗어 나오는 것처럼 보이게 한다
  drawHeadlights(CAR_X + CAR_WIDTH / 2, carY + CAR_HEIGHT, 1);   // 오른쪽 차: 앞이 아래쪽
  drawHeadlights(CAR2_X + CAR_WIDTH / 2, car2Y, -1);             // 왼쪽 차: 앞이 위쪽

  // ----- 자동차 2대 -----
  // 건물보다 먼저 그려야, 위에서 나타나거나 사라질 때 건물 뒤로 지나가는 것처럼 보인다
  // 오른쪽 자동차는 아래로 가므로 그림을 180도 돌려서 앞이 아래를 보게 한다
  // save → 자동차 중심으로 붓을 옮기고 돌린다 → 그린다 → restore로 붓을 원래대로
  ctx.save();
  ctx.translate(CAR_X + CAR_WIDTH / 2, carY + CAR_HEIGHT / 2);
  ctx.rotate(Math.PI);   // Math.PI = 180도
  ctx.drawImage(carImage, -CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
  ctx.restore();

  // 왼쪽 자동차는 위로 가므로 그림 그대로 그린다
  ctx.drawImage(carImage, CAR2_X, car2Y, CAR_WIDTH, CAR_HEIGHT);

  // ----- 6. 강의실 건물 (맨 위) -----
  // 벽돌색 건물 벽
  ctx.fillStyle = "#9c4a3a";
  ctx.fillRect(0, 0, 800, BUILDING_HEIGHT);

  // 건물 지붕 끝선: 아래쪽에 진한 띠
  ctx.fillStyle = "#6e2f24";
  ctx.fillRect(0, BUILDING_HEIGHT - 8, 800, 8);

  // 창문: 하늘색 사각형을 일정한 간격으로 (문 자리는 비운다)
  ctx.fillStyle = "#a8dadc";
  for (let x = 30; x < 800; x += 90) {
    if (x > DOOR_X - 60 && x < DOOR_X + DOOR_WIDTH) {
      continue;   // 문이 있는 자리에는 창문을 그리지 않는다
    }
    ctx.fillRect(x, 55, 50, 26);
  }

  // ----- 7. 강의실 문 (도착 지점) -----
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

  // ----- 8. 다른 학생들: 걷는 방향을 보고, 걸음마다 몸이 좌우로 흔들린다 -----
  for (const student of students) {
    // 학생 그림은 아래쪽을 보고 있다. 오른쪽으로 걸으면 -90도, 왼쪽이면 +90도 돌려서 걷는 쪽을 보게 한다
    let facing;
    if (student.speedX > 0) {
      facing = -Math.PI / 2;
    } else {
      facing = Math.PI / 2;
    }
    // 걸음 흔들림: x(걸어온 거리)로 계산하므로 걸을 때만 흔들린다
    const wobble = Math.sin(student.x * 0.3) * STUDENT_WOBBLE;

    ctx.save();
    ctx.translate(student.x, student.y);   // 학생 중심으로 붓을 옮긴다
    ctx.rotate(facing + wobble);
    // 중심 기준으로 그리기 위해 가로·세로의 반만큼 빼서 그린다
    ctx.drawImage(studentImage, -STUDENT_WIDTH / 2, -STUDENT_HEIGHT / 2, STUDENT_WIDTH, STUDENT_HEIGHT);
    ctx.restore();
  }

  // ----- 10. 플레이어 의자: 바라보는 방향(chairAngle)으로 돌려서 그린다 -----
  ctx.save();
  ctx.translate(chairX + CHAIR_SIZE / 2, chairY + CHAIR_SIZE / 2);   // 의자 중심으로 붓을 옮긴다
  ctx.rotate(chairAngle);
  ctx.drawImage(chairImage, -CHAIR_SIZE / 2, -CHAIR_SIZE / 2, CHAIR_SIZE, CHAIR_SIZE);
  ctx.restore();

  // ----- 구름 그림자 (땅 위 모든 것 위에, 글자·게이지 아래에) -----
  // 타원 3개를 겹쳐서 뭉게구름 모양을 만든다
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  for (const cloud of clouds) {
    const r = CLOUD_RADIUS * cloud.size;
    // 한 경로에 담아 한 번에 칠해야 겹친 부분이 더 진해지지 않는다
    // moveTo로 각 타원의 시작점(오른쪽 끝)으로 먼저 옮겨야 타원끼리 선으로 이어지지 않는다
    ctx.beginPath();
    ctx.moveTo(cloud.x + r, cloud.y);
    ctx.ellipse(cloud.x, cloud.y, r, r * 0.45, 0, 0, Math.PI * 2);                            // 가운데 큰 덩어리
    ctx.moveTo(cloud.x - r * 0.5 + r * 0.5, cloud.y + r * 0.1);
    ctx.ellipse(cloud.x - r * 0.5, cloud.y + r * 0.1, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);   // 왼쪽 작은 덩어리
    ctx.moveTo(cloud.x + r * 0.55 + r * 0.45, cloud.y - r * 0.05);
    ctx.ellipse(cloud.x + r * 0.55, cloud.y - r * 0.05, r * 0.45, r * 0.3, 0, 0, Math.PI * 2); // 오른쪽 작은 덩어리
    ctx.fill();
  }

  // 카메라 끝: 붓을 원래대로 돌린다. 여기부터는 "화면 좌표"로 그린다
  // 남은 시간과 게이지는 스크롤되지 않고 화면에 붙어 있어야 하기 때문이다
  ctx.restore();

  // ----- 11. 글자: 남은 시간 (화면 위 가운데) -----
  // 글자가 잘 보이게 뒤에 반투명 검은 띠를 깐다 (커지는 글자가 들어가게 넉넉히)
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(295, 8, 210, 40);

  // 10초 이하로 남으면 글자를 빨갛게 하고, 1초가 줄 때마다 크게 튀었다가 작아진다
  let timeFontSize = 24;
  if (timeLeft <= 10) {
    ctx.fillStyle = "#ff4d4d";
    if (timeLeft > 0) {
      // 마지막으로 1초가 줄어든 뒤 지난 비율 (0 → 1). 막 줄었을 때 가장 크다
      const passed = (Date.now() - lastSecondTime) / 1000;
      timeFontSize = 24 + 6 * (1 - Math.min(passed, 1));
    }
  } else {
    ctx.fillStyle = "#ffffff";
  }
  ctx.font = "bold " + timeFontSize + "px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("남은 시간 " + timeLeft + "초", 400, 28);

  // ----- 12. 부스터 게이지 (화면 아래 가운데) -----
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

  // ===== ④ 다음 프레임 예약: 다음 그림 때 gameLoop를 또 불러 달라고 부탁한다 =====
  requestAnimationFrame(gameLoop);
}

// ===== 전조등 그리기 =====
// frontX, frontY: 자동차 앞 범퍼 가운데 위치
// direction: 1이면 아래로, -1이면 위로 빛이 뻗는다
function drawHeadlights(frontX, frontY, direction) {
  // 그라데이션: 등 쪽은 밝은 노랑, 멀어질수록 투명해져서 빛이 퍼지며 사라지는 것처럼 보인다
  const endY = frontY + direction * HEADLIGHT_LENGTH;
  const light = ctx.createLinearGradient(0, frontY, 0, endY);
  light.addColorStop(0, "rgba(255, 245, 170, 0.75)");
  light.addColorStop(1, "rgba(255, 245, 170, 0)");
  ctx.fillStyle = light;
  for (const side of [-1, 1]) {            // 왼쪽 등(-1), 오른쪽 등(1)
    const lampX = frontX + side * 12;      // 등 위치: 가운데에서 12픽셀 옆
    ctx.beginPath();
    ctx.moveTo(lampX - 4, frontY);                                       // 등 쪽은 좁고
    ctx.lineTo(lampX + 4, frontY);
    ctx.lineTo(lampX + 12, frontY + direction * HEADLIGHT_LENGTH);       // 멀어질수록 넓게 퍼진다
    ctx.lineTo(lampX - 12, frontY + direction * HEADLIGHT_LENGTH);
    ctx.closePath();
    ctx.fill();
  }
}
