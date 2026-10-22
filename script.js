const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

// ===== 좌표와 크기 (여기 숫자만 바꾸면 그림이 바뀐다) =====
// 화면 크기: 가로 800, 세로 600. (0, 0)은 왼쪽 위, y가 커지면 아래로 간다.

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

// 나무: 잔디 위 (이미지의 왼쪽 위 꼭짓점 좌표)
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

// 플레이어(의자): 50×50, 화면 중간 아래부분
const CHAIR_X = 375;      // 왼쪽 위 꼭짓점 x
const CHAIR_Y = 490;      // 왼쪽 위 꼭짓점 y
const CHAIR_SIZE = 50;

// 다른 학생: 위에서 본 초록 옷 학생 (x, y는 "중심")
const STUDENT_WIDTH = 52;
const STUDENT_HEIGHT = 36;
// 학생들은 두 자동차 차선 사이에서만 좌우로 천천히 걷다가, 차선에 닿기 전에 돌아선다
// x가 매 프레임 바뀌므로 let. speedX는 한 프레임에 가로로 걷는 양 (양수 = 오른쪽)
let students = [
  { x: 280, y: 330, speedX: 1 },
  { x: 520, y: 240, speedX: -0.7 },
  { x: 420, y: 200, speedX: 0.5 },
];

// 자동차: 40×70, 오른쪽 차선을 따라 아래로 내려간다
const CAR_X = 590;        // 차선 위치 (가로는 움직이지 않는다)
const CAR_WIDTH = 40;
const CAR_HEIGHT = 70;
let carY = 300;           // 자동차의 세로 위치 (매 프레임 바뀐다)
let carSpeedY = 6;        // 한 프레임에 아래로 6씩 (양수 = 아래, 음수 = 위)

// 자동차 2: 왼쪽 차선을 따라 위로 올라간다 (반대 방향, 다른 속도)
const CAR2_X = 170;       // 왼쪽 차선 위치 (오른쪽 자동차와 대칭)
let car2Y = 450;          // 자동차 2의 세로 위치
let car2SpeedY = -4;      // 한 프레임에 위로 4씩 (음수 = 위)

// 학생이 걸어 다닐 수 있는 구역: 왼쪽 자동차 차선 오른쪽 ~ 오른쪽 자동차 차선 왼쪽
// 자동차와 15픽셀 여유를 두어서 학생과 자동차가 절대 겹치지 않는다
const WALK_LEFT = CAR2_X + CAR_WIDTH + 15;    // 225
const WALK_RIGHT = CAR_X - 15;                // 575

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

// ===== 게임 루프: 지우기 → 계산 → 그리기 → 다음 프레임 예약 =====

function gameLoop() {
  // ===== ① 지우기: 이전 프레임 그림을 없앤다 =====
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ===== ② 계산: 상태(숫자)를 바꾼다 =====

  // 자동차를 속도만큼 아래로 옮긴다
  carY = carY + carSpeedY;

  // 화면 아래로 완전히 사라지면, 화면 위(건물 뒤)에서 다시 나타난다
  if (carY > canvas.height) {
    carY = -CAR_HEIGHT;
  }

  // 흔들림 시계를 조금 앞으로 돌린다 (풀잎 흔들림에 쓴다)
  swayTime = swayTime + SWAY_SPEED;

  // 자동차 2를 속도만큼 위로 옮긴다 (속도가 음수라 y가 줄어든다)
  car2Y = car2Y + car2SpeedY;

  // 화면 위(건물 뒤)로 완전히 사라지면, 화면 아래에서 다시 나타난다
  if (car2Y + CAR_HEIGHT < 0) {
    car2Y = canvas.height;
  }

  // 학생들을 걷는 속도만큼 옮기고, 걷는 구역 끝(자동차 차선 앞)에 닿으면 방향을 뒤집는다
  for (const student of students) {
    student.x = student.x + student.speedX;
    if (student.x + STUDENT_WIDTH / 2 > WALK_RIGHT || student.x - STUDENT_WIDTH / 2 < WALK_LEFT) {
      student.speedX = -student.speedX;
    }
  }

  // 1초(1000밀리초)가 지났으면 남은 시간을 1 줄인다 (0에서 멈춘다)
  // 프레임 수를 세지 않고 실제 시계로 재므로, 화면이 빠른 기기에서도 똑같이 1초다
  if (Date.now() - lastSecondTime >= 1000 && timeLeft > 0) {
    timeLeft = timeLeft - 1;
    lastSecondTime = lastSecondTime + 1000;
  }

  // ===== ③ 그리기: 바뀐 숫자대로 화면을 그린다 =====

  // ----- 1. 잔디 (양쪽) -----
  // [새로 시도] 패턴: 작은 잔디 그림을 타일처럼 반복해서 칠한다
  ctx.fillStyle = ctx.createPattern(grassImage, "repeat");
  ctx.fillRect(0, 0, GRASS_WIDTH, 600);                  // 왼쪽 잔디
  ctx.fillRect(800 - GRASS_WIDTH, 0, GRASS_WIDTH, 600);  // 오른쪽 잔디

  // 풀 포기: 포기마다 풀잎 3개. 끝부분이 sin(사인) 물결처럼 좌우로 흔들린다
  // 포기마다 위치를 더해서 흔들리는 타이밍을 다르게 → 바람이 지나가는 것처럼 보인다
  ctx.strokeStyle = "#2f7d32";
  ctx.lineWidth = 2;
  for (const tuft of GRASS_TUFTS) {
    const sway = Math.sin(swayTime + tuft.x * 0.05 + tuft.y * 0.03) * GRASS_SWAY;
    for (let i = -1; i <= 1; i++) {
      const rootX = tuft.x + i * 4;                        // 풀잎 뿌리 (4픽셀 간격)
      const tipX = rootX + i * 3 + sway;                    // 풀잎 끝 (바깥으로 벌어지고 + 흔들림)
      const tipY = tuft.y - GRASS_BLADE_HEIGHT + Math.abs(i) * 3;   // 가운데 잎이 제일 길다
      ctx.beginPath();
      ctx.moveTo(rootX, tuft.y);
      ctx.quadraticCurveTo(rootX, tuft.y - GRASS_BLADE_HEIGHT / 2, tipX, tipY);   // 살짝 휜 풀잎
      ctx.stroke();
    }
  }

  // ----- 2. 인도 (양쪽): 밝은 회색 + 보도블록 줄 -----
  ctx.fillStyle = "#bfbfbf";
  ctx.fillRect(GRASS_WIDTH, 0, SIDEWALK_WIDTH, 600);     // 왼쪽 인도
  ctx.fillRect(ROAD_RIGHT, 0, SIDEWALK_WIDTH, 600);      // 오른쪽 인도

  ctx.strokeStyle = "#a6a6a6";
  ctx.lineWidth = 1;
  for (let y = 0; y <= 600; y += 40) {
    ctx.beginPath();
    ctx.moveTo(GRASS_WIDTH, y);
    ctx.lineTo(ROAD_LEFT, y);
    ctx.moveTo(ROAD_RIGHT, y);
    ctx.lineTo(800 - GRASS_WIDTH, y);
    ctx.stroke();
  }

  // ----- 3. 차도: 진한 회색 아스팔트 -----
  ctx.fillStyle = "#4d4d4d";
  ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, 600);

  // 차도 양쪽 흰 실선
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(ROAD_LEFT + 6, 0, 4, 600);
  ctx.fillRect(ROAD_RIGHT - 10, 0, 4, 600);

  // 가운데 노란 점선: 횡단보도 아래부터 30 그리고 20 쉬고를 반복
  ctx.fillStyle = "#f2c200";
  for (let y = CROSSWALK_Y + CROSSWALK_HEIGHT + 20; y < 600; y += 50) {
    ctx.fillRect(398, y, 4, 30);
  }

  // ----- 4. 횡단보도: 흰 줄무늬 -----
  ctx.fillStyle = "#ffffff";
  for (let x = ROAD_LEFT + 20; x < ROAD_RIGHT - 20; x += 40) {
    ctx.fillRect(x, CROSSWALK_Y, 20, CROSSWALK_HEIGHT);
  }

  // ----- 5. 나무 (잔디 위) -----
  for (const tree of TREES) {
    ctx.drawImage(treeImage, tree.x, tree.y, TREE_SIZE, TREE_SIZE);
  }

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

  // ----- 8. 다른 학생들 -----
  for (const student of students) {
    // 이미지는 왼쪽 위 꼭짓점 기준이라, 중심 (x, y)에서 반만큼 빼서 그린다
    ctx.drawImage(
      studentImage,
      student.x - STUDENT_WIDTH / 2,
      student.y - STUDENT_HEIGHT / 2,
      STUDENT_WIDTH,
      STUDENT_HEIGHT
    );
  }

  // ----- 10. 플레이어 의자 -----
  ctx.drawImage(chairImage, CHAIR_X, CHAIR_Y, CHAIR_SIZE, CHAIR_SIZE);

  // ----- 11. 글자: 남은 시간 (화면 위 가운데) -----
  // 글자가 잘 보이게 뒤에 반투명 검은 띠를 깐다
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(310, 10, 180, 36);

  // 10초 이하로 남으면 글자를 빨갛게 해서 급하다는 걸 보여 준다
  if (timeLeft <= 10) {
    ctx.fillStyle = "#ff4d4d";
  } else {
    ctx.fillStyle = "#ffffff";
  }
  ctx.font = "bold 24px sans-serif";
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
