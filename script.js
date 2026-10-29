const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

// ===== 좌표와 크기 (여기 숫자만 바꾸면 그림이 바뀐다) =====
// 화면 크기: 가로 800, 세로 600. (0, 0)은 왼쪽 위, y가 커지면 아래로 간다.

// ===== 맵과 카메라 (스크롤) =====
// 맵은 화면보다 세로로 길다. 아래 좌표들은 전부 "맵 위의 좌표"다 (맵 맨 위 = 0, 강의실이 있는 곳).
// 화면은 맵의 일부만 비추는 카메라다. 카메라는 의자 뒤에 붙어서, 의자가 도는 대로 같이 돈다 (추격 시점).
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const WORLD_LEFT = -400;                    // 맵 왼쪽 끝 x (화면 폭 바깥으로 400 더 넓다)
const WORLD_RIGHT = 1200;                   // 맵 오른쪽 끝 x
const WORLD_HEIGHT = SCREEN_HEIGHT * 12;    // 맵 전체 세로 길이 (화면 12장 = 7200)
const CAMERA_ANCHOR_Y = 430;                // 의자가 화면에서 머무르는 높이 (가로는 한가운데). 아래쪽이라 앞이 넓게 보인다
const CAMERA_TURN_FOLLOW = 0.08;            // 카메라가 의자 방향을 따라 도는 빠르기 (0~1). 작을수록 늦게, 부드럽게 따라 돈다
const VIEW_RADIUS = 650;                    // 화면이 돌아가도 보일 수 있는 의자 주변 범위 (이 밖은 그리지 않는다)
let cameraAngle = 0;                        // 카메라가 바라보는 방향 (0 = 맵 위쪽)

// ===== 트랙 (구불구불한 캠퍼스 도로) =====
// 길 가운데 선의 x 위치를 높이(y)마다 정해 둔 점들. 맵 맨 아래(출발)에서 맨 위(강의실) 순서
// 점과 점 사이는 부드럽게 이어진다. y 간격이 짧은데 x 차이가 크면 급커브가 된다
const TRACK = [
  { y: 7200, x: 400 },
  { y: 6600, x: 400 },   // 출발 직선
  { y: 6000, x: 520 },   // 완만한 S자 커브
  { y: 5400, x: 290 },
  { y: 5000, x: 290 },
  { y: 4640, x: 530 },   // 오른쪽 급커브
  { y: 4200, x: 530 },
  { y: 3600, x: 310 },   // 완만한 S자 커브
  { y: 3000, x: 500 },
  { y: 2700, x: 500 },
  { y: 2340, x: 260 },   // 왼쪽 급커브
  { y: 1900, x: 260 },
  { y: 1400, x: 470 },   // 마지막 S자 커브
  { y: 950, x: 330 },
  { y: 600, x: 400 },
  { y: 0, x: 400 },      // 강의실 앞 직선
];
const TRACK_STEP = 8;         // 길을 그릴 때 몇 픽셀마다 점을 찍어 이을지 (작을수록 매끄럽지만 느리다)

// 길 단면: 왼쪽부터 잔디 → 인도 → 차도 → 인도 → 잔디 (전부 길 가운데 선에서 떨어진 거리)
const ROAD_HALF = 160;        // 차도 반폭 (차도 전체 폭 320)
const SIDEWALK_WIDTH = 60;    // 양쪽 인도 폭 (학생 어깨 폭 52가 들어가게)
const LANE_OFFSET = 80;       // 자동차 차선 가운데가 길 가운데 선에서 떨어진 거리
const GRASS_SPEED_RATE = 0.5; // 잔디 위에서는 최고 속도가 이 비율로 줄어든다 (길을 벗어나면 느려진다)

// 강의실 건물: 맵 맨 위 끝
const BUILDING_HEIGHT = 100;

// 횡단보도: 건물 바로 앞
const CROSSWALK_Y = 120;
const CROSSWALK_HEIGHT = 40;

// 나무와 풀: 시작할 때 잔디 위 빈자리에 자동으로 배치한다 (아래 placeScenery 함수)
const TREE_SIZE = 80;
let trees = [];               // { x, y } 이미지의 왼쪽 위 꼭짓점
let grassTufts = [];          // { x, y } 풀 뿌리 위치
const TREE_GAP = 170;         // 나무를 놓을 세로 간격
const TUFT_GAP = 40;          // 풀 포기를 놓을 세로 간격
const GRASS_BLADE_HEIGHT = 18;   // 풀잎 길이
const GRASS_SWAY = 4;            // 풀잎 끝이 좌우로 흔들리는 최대 거리
let swayTime = 0;                // 흔들림 시계: 매 프레임 조금씩 커진다
const SWAY_SPEED = 0.05;         // 흔들리는 빠르기 (클수록 빨리 흔들린다)
const TREE_SWAY_ANGLE = 0.04;    // 나무가 좌우로 기우는 최대 각도 (0.04 ≈ 2도)

// 구름 그림자: 하늘의 구름이 땅에 드리운 반투명 그림자가 천천히 가로지른다
// 시작할 때 맵 전체에 화면 한 장마다 하나씩 배치한다. size는 크기 배율 (1 = 기본)
let clouds = [];
const CLOUD_RADIUS = 110;        // 구름 그림자 가로 반지름 (size가 1일 때)

// 플레이어(의자): 50×50, 맵 맨 아래 출발 직선에서 출발한다
// 방향키로 움직이므로 위치는 let (chairX, chairY는 왼쪽 위 꼭짓점)
const CHAIR_SIZE = 50;
let chairX = 375;
let chairY = WORLD_HEIGHT - 110;

// ===== 조작 설정 (여기 숫자를 바꿔 가며 조작 느낌을 튜닝한다) =====
const CHAIR_SPEED = 6;        // 이동 속도: 한 프레임에 움직이는 픽셀 수 (최고 속도)
const GRIP = 0.25;            // 평소 접지력 (0~1): 클수록 키를 누른 방향으로 바로 꺾이고 바로 선다
const DRIFT_GRIP = 0.03;      // Shift 드리프트 중 접지력: 작을수록 관성이 커서 옆으로 오래 미끄러진다
const TURN_RATE = 0.05;       // ← → 키로 한 프레임에 도는 각도 (라디안, 0.05 ≈ 3도)
const REVERSE_SPEED_RATE = 0.5;  // ↓ 키로 뒤로 갈 때는 최고 속도의 이 비율만큼만

let chairVX = 0;              // 의자의 지금 가로 속도 (양수 = 오른쪽)
let chairVY = 0;              // 의자의 지금 세로 속도 (양수 = 아래)
let chairAngle = 0;           // 의자가 바라보는 방향 (0 = 위쪽, 단위는 라디안)

// ===== 드리프트 연출 =====
const DRIFT_TURN_RATE = 0.08; // 드리프트 중에는 더 빨리 돈다 → 몸은 휙 돌고 몸통은 원래 방향으로 미끄러진다
const DRIFT_MIN_SPEED = 1.5;  // 이 속도보다 느리면 드리프트 연출(자국, 연기)을 하지 않는다
let isDrifting = false;       // 지금 드리프트로 미끄러지는 중인가 (연출을 켜고 끄는 데 쓴다)

// 스키드 마크: 뒷바퀴가 지나간 자리에 남는 타이어 자국 (짧은 선분들의 목록)
// 선분마다 { x1, y1, x2, y2, life }. life가 줄어들수록 흐려지고 0이 되면 지운다
let skidMarks = [];
const SKID_LIFE = 240;        // 자국이 사라지기까지 걸리는 프레임 수 (240 ≈ 4초)
const SKID_WIDTH = 4;         // 자국 굵기
let lastWheels = null;        // 직전 프레임의 뒷바퀴 위치 (자국 선을 이어 그리는 데 쓴다)

// 바퀴 연기: 드리프트 중 뒷바퀴에서 피어오르는 회색 연기 ({ x, y, size, life })
let smokes = [];
const SMOKE_LIFE = 40;        // 연기가 사라지기까지 걸리는 프레임 수

// 조작 방식 비교 실험용 스위치 (워크북 5장 Step 2 · Step 3)
// "A" = keydown 안에서 직접 움직이는 방식 (꾹 누르면 끊기고, 대각선이 안 된다)
// "B" = keys에 눌린 상태를 기록하고, 게임 루프에서 움직이는 방식 (매끄럽다)
const CONTROL_METHOD = "B";

// 눌린 키를 적어 두는 메모장: keys["ArrowLeft"]가 true면 지금 왼쪽 키가 눌려 있다
const keys = {};

// 다른 학생: 위에서 본 초록 옷 학생 (x, y는 "중심")
const STUDENT_WIDTH = 52;
const STUDENT_HEIGHT = 36;
// 학생들은 차도가 아니라 양쪽 인도 위를 따라 걷는다 (차는 차도, 사람은 인도)
// 학생마다 자기 구간(minY ~ maxY)만 오가다가 끝에 닿으면 돌아선다. 구간이 겹치지 않아 학생끼리 겹치지 않는다
// side는 어느 쪽 인도인지 (-1 = 왼쪽, 1 = 오른쪽). x는 길이 휘는 대로 매 프레임 다시 계산한다
let students = [];
const STUDENT_GAP = 500;      // 학생을 놓을 세로 간격
const STUDENT_WALK_RANGE = 260;  // 한 학생이 오가는 구간 길이
const STUDENT_WOBBLE = 0.12;  // 걸을 때 몸이 좌우로 흔들리는 각도 (0.12 ≈ 7도)

// 자동차: 40×70, 길을 따라 달린다. 길이 휘면 차도 휘는 방향으로 돌아간다
const CAR_WIDTH = 40;
const CAR_HEIGHT = 70;
// 자동차 1: 오른쪽 차선을 따라 아래로 내려간다
let carY = WORLD_HEIGHT - 300;   // 자동차의 세로 위치 (매 프레임 바뀐다)
let carSpeedY = 6;        // 한 프레임에 아래로 6씩 (양수 = 아래, 음수 = 위)
// 자동차 2: 왼쪽 차선을 따라 위로 올라간다 (반대 방향, 다른 속도)
let car2Y = WORLD_HEIGHT - 150;  // 자동차 2의 세로 위치
let car2SpeedY = -4;      // 한 프레임에 위로 4씩 (음수 = 위)

// 자동차 전조등: 자동차 앞쪽으로 뻗는 노란 반투명 빛
const HEADLIGHT_LENGTH = 45;  // 빛이 뻗는 길이

// 강의실 문: 노란 사각형 + "강의실" 글자 (건물 아래쪽에 붙어 있다)
const DOOR_X = 340;
const DOOR_Y = 60;
const DOOR_WIDTH = 120;
const DOOR_HEIGHT = 40;

// 남은 시간 글자: 화면 위 가운데
let timeLeft = 90;        // 남은 시간(초). 1초마다 1씩 줄어든다 (트랙이 길어져서 90초)
let lastSecondTime = 0;   // 마지막으로 1초를 줄인 시각 (Date.now() 값, 밀리초)

// 부스터 게이지: 화면 아래 가운데
const GAUGE_X = 300;
const GAUGE_Y = 570;
const GAUGE_WIDTH = 200;
const GAUGE_HEIGHT = 14;
const GAUGE_FILL = 0.4;   // 0 = 비어 있음, 1 = 가득 참

// ===== 맵 꾸미기: 나무·풀·학생·구름을 길을 피해서 배치한다 (시작할 때 한 번) =====
placeScenery();

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
    // 1) 눌린 방향키 읽기: ↑↓는 앞뒤(throttle), ←→는 핸들(steer)
    //    두 키를 같이 누르면 두 줄이 다 실행되므로, 앞으로 가면서 꺾을 수 있다
    let throttle = 0;   // 1 = 앞으로, -REVERSE_SPEED_RATE = 뒤로, 0 = 안 누름
    let steer = 0;      // -1 = 왼쪽으로 꺾기, 1 = 오른쪽으로 꺾기
    if (keys["ArrowUp"]) throttle = 1;
    if (keys["ArrowDown"]) throttle = -REVERSE_SPEED_RATE;
    if (keys["ArrowLeft"]) steer = steer - 1;
    if (keys["ArrowRight"]) steer = steer + 1;

    // 2) Shift를 누르고 있으면 드리프트: 접지력이 약해져서 미끄러지고, 핸들은 더 잘 돈다
    let grip = GRIP;
    let turnRate = TURN_RATE;
    if (keys["Shift"]) {
      grip = DRIFT_GRIP;
      turnRate = DRIFT_TURN_RATE;
    }

    // 3) 핸들: 의자가 바라보는 방향을 돌린다 (바퀴 달린 의자라 제자리에서도 돈다)
    chairAngle = chairAngle + steer * turnRate;

    // 4) 길(차도·인도)을 벗어나 잔디 위에 있으면 최고 속도가 줄어든다
    let maxSpeed = CHAIR_SPEED;
    if (isOnGrass(chairX + CHAIR_SIZE / 2, chairY + CHAIR_SIZE / 2)) {
      maxSpeed = CHAIR_SPEED * GRASS_SPEED_RATE;
    }

    // 5) 목표 속도 = 의자가 바라보는 방향 × 최고 속도 × throttle
    //    각도 0이 위쪽이라, 바라보는 방향의 가로 성분은 sin, 세로 성분은 -cos이다
    const targetVX = Math.sin(chairAngle) * maxSpeed * throttle;
    const targetVY = -Math.cos(chairAngle) * maxSpeed * throttle;

    // 6) 지금 속도가 목표 속도를 grip 비율만큼만 따라간다
    //    grip이 크면 바라보는 쪽으로 바로 가고, 작으면 원래 가던 쪽으로 계속 미끄러진다 (관성 = 드리프트)
    chairVX = chairVX + (targetVX - chairVX) * grip;
    chairVY = chairVY + (targetVY - chairVY) * grip;

    // 7) 속도만큼 위치를 옮긴다
    chairX = chairX + chairVX;
    chairY = chairY + chairVY;

    // 8) 지금 드리프트 중인가: Shift를 누르고 있고, 어느 정도 빠르게 움직이는 중
    const speed = Math.hypot(chairVX, chairVY);               // 지금 속력 (가로·세로 속도로 만든 빗변 길이)
    isDrifting = keys["Shift"] && speed > DRIFT_MIN_SPEED;
  }

  // 드리프트 연출: 뒷바퀴 자리에 스키드 마크와 연기를 남긴다
  if (isDrifting) {
    const wheels = getRearWheels();
    if (lastWheels !== null) {
      // 직전 바퀴 위치 → 지금 바퀴 위치를 잇는 짧은 선을 바퀴마다 하나씩 남긴다
      for (let i = 0; i < 2; i++) {
        skidMarks.push({ x1: lastWheels[i].x, y1: lastWheels[i].y, x2: wheels[i].x, y2: wheels[i].y, life: SKID_LIFE });
      }
    }
    lastWheels = wheels;

    // 두 프레임에 한 번꼴로 바퀴 한쪽에서 연기를 피운다
    if (Math.random() < 0.5) {
      const wheel = wheels[Math.floor(Math.random() * 2)];
      smokes.push({ x: wheel.x, y: wheel.y, size: 6, life: SMOKE_LIFE });
    }
  } else {
    lastWheels = null;   // 드리프트가 끊기면 다음 자국은 새로 시작한다 (멀리 떨어진 곳끼리 잇지 않게)
  }

  // 자국과 연기의 수명을 줄이고, 다 된 것은 지운다
  // 지우면 뒤 칸이 앞으로 당겨지므로, 뒤에서부터 앞으로 거꾸로 돌아야 하나도 건너뛰지 않는다
  for (let i = skidMarks.length - 1; i >= 0; i--) {
    skidMarks[i].life = skidMarks[i].life - 1;
    if (skidMarks[i].life <= 0) skidMarks.splice(i, 1);
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    smokes[i].life = smokes[i].life - 1;
    smokes[i].size = smokes[i].size + 0.5;   // 연기는 퍼지면서 커진다
    if (smokes[i].life <= 0) smokes.splice(i, 1);
  }

  // 의자가 맵 밖으로 나가지 않게 네 벽에서 막는다 (벽에 닿으면 그 방향 속도는 0)
  // 오른쪽·아래쪽은 의자 크기를 뺀다 (chairX는 왼쪽 위 꼭짓점이라, 빼지 않으면 반쯤 박힌다)
  // 위쪽 벽은 강의실 건물 아래 끝이다 (건물 안으로는 못 들어간다)
  if (chairX < WORLD_LEFT) {
    chairX = WORLD_LEFT;
    chairVX = 0;
  }
  if (chairX > WORLD_RIGHT - CHAIR_SIZE) {
    chairX = WORLD_RIGHT - CHAIR_SIZE;
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

  // 카메라가 의자 뒤에서 의자가 바라보는 방향으로 천천히 따라 돈다
  // 한 번에 다 돌지 않고 차이의 일부만 돌아서, 드리프트할 때 화면이 덜덜 떨리지 않고 부드럽게 돈다
  cameraAngle = cameraAngle + angleDiff(chairAngle, cameraAngle) * CAMERA_TURN_FOLLOW;
  const chairCenterX = chairX + CHAIR_SIZE / 2;
  const chairCenterY = chairY + CHAIR_SIZE / 2;

  // 자동차를 속도만큼 아래로 옮긴다
  carY = carY + carSpeedY;

  // 의자 주변 보이는 범위 아래로 완전히 사라지면, 범위 바로 위에서 다시 나타난다
  // 맵 맨 위에서는 건물 뒤에서 나오는 것처럼 보인다
  if (carY > chairCenterY + VIEW_RADIUS) {
    carY = chairCenterY - VIEW_RADIUS - CAR_HEIGHT;
  }

  // 흔들림 시계를 조금 앞으로 돌린다 (풀잎 흔들림에 쓴다)
  swayTime = swayTime + SWAY_SPEED;

  // 자동차 2를 속도만큼 위로 옮긴다 (속도가 음수라 y가 줄어든다)
  car2Y = car2Y + car2SpeedY;

  // 의자 주변 보이는 범위 위로 완전히 사라지면, 범위 바로 아래에서 다시 나타난다
  if (car2Y + CAR_HEIGHT < chairCenterY - VIEW_RADIUS) {
    car2Y = chairCenterY + VIEW_RADIUS;
  }

  // 학생들을 인도 위에서 걷는 속도만큼 옮기고, 자기 구간 끝에 닿으면 방향을 뒤집는다
  // 세로(y)로 걷고, 가로(x)는 그 높이의 인도 한가운데로 맞춘다 → 길이 휘면 학생도 따라 휜다
  for (const student of students) {
    student.y = student.y + student.speedY;
    if (student.y > student.maxY || student.y < student.minY) {
      student.speedY = -student.speedY;
    }
    student.x = roadCenterX(student.y) + student.side * (ROAD_HALF + SIDEWALK_WIDTH / 2);
  }

  // 구름 그림자를 오른쪽으로 천천히 옮기고, 맵 오른쪽 끝 밖으로 나가면 왼쪽 끝 밖에서 다시 들어온다
  for (const cloud of clouds) {
    cloud.x = cloud.x + cloud.speedX;
    if (cloud.x - CLOUD_RADIUS * cloud.size > WORLD_RIGHT) {
      cloud.x = WORLD_LEFT - CLOUD_RADIUS * cloud.size;
    }
  }

  // 1초(1000밀리초)가 지났으면 남은 시간을 1 줄인다 (0에서 멈춘다)
  // 프레임 수를 세지 않고 실제 시계로 재므로, 화면이 빠른 기기에서도 똑같이 1초다
  if (Date.now() - lastSecondTime >= 1000 && timeLeft > 0) {
    timeLeft = timeLeft - 1;
    lastSecondTime = lastSecondTime + 1000;
  }

  // ===== ③ 그리기: 바뀐 숫자대로 화면을 그린다 =====

  // 카메라 (추격 시점): 세 단계로 붓을 옮긴다. 아래에서부터 거꾸로 읽으면 이해하기 쉽다
  //   ③ 의자 중심이 (0, 0)에 오게 맵을 민다
  //   ② 카메라 각도만큼 맵을 반대로 돌린다 → 의자가 바라보는 쪽이 화면 위쪽이 된다
  //   ① (0, 0)을 화면 가운데 아래(의자 자리)로 옮긴다
  // 여기부터 restore 전까지는 전부 "맵 위의 좌표"로 그린다
  ctx.save();
  ctx.translate(SCREEN_WIDTH / 2, CAMERA_ANCHOR_Y);   // ①
  ctx.rotate(-cameraAngle);                           // ②
  ctx.translate(-chairCenterX, -chairCenterY);        // ③

  // 지금 화면에 보이는 맵 범위 (보이지 않는 곳은 그리지 않아서 빠르게)
  // 화면이 돌아가 있어서, 의자 주변 VIEW_RADIUS 안은 어느 방향이든 보일 수 있다
  const viewTop = chairCenterY - VIEW_RADIUS;
  const viewBottom = chairCenterY + VIEW_RADIUS;
  const viewLeft = chairCenterX - VIEW_RADIUS;
  const viewRight = chairCenterX + VIEW_RADIUS;

  // ----- 1. 잔디 (화면 전체 바닥) -----
  // [새로 시도] 패턴: 작은 잔디 그림을 타일처럼 반복해서 칠한다. 길은 이 위에 덮어 그린다
  ctx.fillStyle = ctx.createPattern(grassImage, "repeat");
  ctx.fillRect(viewLeft, viewTop, VIEW_RADIUS * 2, VIEW_RADIUS * 2);

  // 풀 포기: 포기마다 풀잎 3개. 끝부분이 sin(사인) 물결처럼 좌우로 흔들린다
  // 포기마다 위치를 더해서 흔들리는 타이밍을 다르게 → 바람이 지나가는 것처럼 보인다
  ctx.strokeStyle = "#2f7d32";
  ctx.lineWidth = 2;
  for (const tuft of grassTufts) {
    if (tuft.y < viewTop || tuft.y > viewBottom + GRASS_BLADE_HEIGHT) continue;   // 화면 밖이면 건너뛴다
    if (tuft.x < viewLeft || tuft.x > viewRight) continue;
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

  // ----- 2. 인도 (양쪽): 밝은 회색 띠 + 보도블록 줄 -----
  // 인도 바깥 끝부터 반대편 인도 바깥 끝까지 통째로 칠하고, 그 위에 차도를 덮어 그린다
  ctx.fillStyle = "#bfbfbf";
  fillTrackBand(-(ROAD_HALF + SIDEWALK_WIDTH), ROAD_HALF + SIDEWALK_WIDTH, viewTop, viewBottom);

  ctx.strokeStyle = "#a6a6a6";
  ctx.lineWidth = 1;
  for (let y = Math.floor(viewTop / 40) * 40; y <= viewBottom; y += 40) {
    const center = roadCenterX(y);
    ctx.beginPath();
    ctx.moveTo(center - ROAD_HALF - SIDEWALK_WIDTH, y);   // 왼쪽 인도
    ctx.lineTo(center - ROAD_HALF, y);
    ctx.moveTo(center + ROAD_HALF, y);                    // 오른쪽 인도
    ctx.lineTo(center + ROAD_HALF + SIDEWALK_WIDTH, y);
    ctx.stroke();
  }

  // ----- 3. 차도: 진한 회색 아스팔트 -----
  ctx.fillStyle = "#4d4d4d";
  fillTrackBand(-ROAD_HALF, ROAD_HALF, viewTop, viewBottom);

  // 차도 양쪽 흰 실선 (차도 끝에서 6~10픽셀 안쪽)
  ctx.fillStyle = "#ffffff";
  fillTrackBand(-ROAD_HALF + 6, -ROAD_HALF + 10, viewTop, viewBottom);
  fillTrackBand(ROAD_HALF - 10, ROAD_HALF - 6, viewTop, viewBottom);

  // 가운데 노란 점선: 횡단보도 아래부터 30 그리고 20 쉬고를 반복. 길이 휘는 대로 비스듬히 긋는다
  ctx.strokeStyle = "#f2c200";
  ctx.lineWidth = 4;
  const dashStart = CROSSWALK_Y + CROSSWALK_HEIGHT + 20;
  for (let y = dashStart + Math.max(0, Math.floor((viewTop - dashStart) / 50)) * 50; y < viewBottom; y += 50) {
    ctx.beginPath();
    ctx.moveTo(roadCenterX(y), y);
    ctx.lineTo(roadCenterX(y + 30), y + 30);
    ctx.stroke();
  }

  // ----- 4. 횡단보도: 흰 줄무늬 (강의실 앞 직선 구간) -----
  ctx.fillStyle = "#ffffff";
  const crosswalkCenter = roadCenterX(CROSSWALK_Y);
  for (let x = crosswalkCenter - ROAD_HALF + 20; x < crosswalkCenter + ROAD_HALF - 20; x += 40) {
    ctx.fillRect(x, CROSSWALK_Y, 20, CROSSWALK_HEIGHT);
  }

  // ----- 스키드 마크: 땅바닥에 붙은 자국이라 땅 그림 바로 위, 나머지 모든 것 아래에 -----
  // 남은 수명(life)이 적을수록 투명하게 그려서 서서히 사라지게 한다
  ctx.lineWidth = SKID_WIDTH;
  ctx.lineCap = "round";
  for (const mark of skidMarks) {
    ctx.strokeStyle = "rgba(20, 20, 20, " + (0.45 * mark.life / SKID_LIFE) + ")";
    ctx.beginPath();
    ctx.moveTo(mark.x1, mark.y1);
    ctx.lineTo(mark.x2, mark.y2);
    ctx.stroke();
  }
  ctx.lineCap = "butt";   // 다른 선 그리기에 영향이 없게 원래대로

  // ----- 5. 나무 (잔디 위): 풀과 같은 흔들림 시계로 살짝 기울었다 돌아온다 -----
  for (const tree of trees) {
    if (tree.y + TREE_SIZE < viewTop || tree.y > viewBottom) continue;   // 화면 밖이면 건너뛴다
    if (tree.x < viewLeft || tree.x > viewRight) continue;
    const angle = Math.sin(swayTime * 0.8 + tree.y * 0.02) * TREE_SWAY_ANGLE;
    ctx.save();
    ctx.translate(tree.x + TREE_SIZE / 2, tree.y + TREE_SIZE / 2);   // 나무 중심으로 붓을 옮긴다
    ctx.rotate(angle);                                              // 그 자리에서 살짝 돌린다
    ctx.drawImage(treeImage, -TREE_SIZE / 2, -TREE_SIZE / 2, TREE_SIZE, TREE_SIZE);
    ctx.restore();
  }

  // ----- 자동차 2대 (전조등 포함) -----
  // 건물보다 먼저 그려야, 위에서 나타나거나 사라질 때 건물 뒤로 지나가는 것처럼 보인다
  drawCar(1, carY, true);      // 오른쪽 차선, 아래로 내려가는 차
  drawCar(-1, car2Y, false);   // 왼쪽 차선, 위로 올라가는 차

  // ----- 6. 강의실 건물 (맨 위) -----
  // 벽돌색 건물 벽
  ctx.fillStyle = "#9c4a3a";
  // 화면이 돌면 맵 끝 바깥과 건물 뒤쪽도 보이므로, 건물을 바깥까지 넉넉히 칠한다
  ctx.fillRect(WORLD_LEFT - VIEW_RADIUS, -VIEW_RADIUS, WORLD_RIGHT - WORLD_LEFT + VIEW_RADIUS * 2, BUILDING_HEIGHT + VIEW_RADIUS);

  // 건물 지붕 끝선: 아래쪽에 진한 띠
  ctx.fillStyle = "#6e2f24";
  ctx.fillRect(WORLD_LEFT - VIEW_RADIUS, BUILDING_HEIGHT - 8, WORLD_RIGHT - WORLD_LEFT + VIEW_RADIUS * 2, 8);

  // 창문: 하늘색 사각형을 일정한 간격으로 (문 자리는 비운다)
  ctx.fillStyle = "#a8dadc";
  for (let x = WORLD_LEFT + 30; x < WORLD_RIGHT; x += 90) {
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

  // ----- 8. 다른 학생들: 인도가 휜 방향을 따라 걷는 쪽을 보고, 걸음마다 몸이 좌우로 흔들린다 -----
  for (const student of students) {
    if (student.y < viewTop - STUDENT_WIDTH || student.y > viewBottom + STUDENT_WIDTH) continue;
    // 학생 그림은 아래쪽을 보고 있다. 아래로 걸으면 길 기울기만큼만, 위로 걸으면 180도 더 돌린다
    let facing = Math.atan(-roadSlope(student.y));
    if (student.speedY < 0) {
      facing = facing + Math.PI;
    }
    // 걸음 흔들림: y(걸어온 거리)로 계산하므로 걸을 때만 흔들린다
    const wobble = Math.sin(student.y * 0.3) * STUDENT_WOBBLE;

    ctx.save();
    ctx.translate(student.x, student.y);   // 학생 중심으로 붓을 옮긴다
    ctx.rotate(facing + wobble);
    // 중심 기준으로 그리기 위해 가로·세로의 반만큼 빼서 그린다
    ctx.drawImage(studentImage, -STUDENT_WIDTH / 2, -STUDENT_HEIGHT / 2, STUDENT_WIDTH, STUDENT_HEIGHT);
    ctx.restore();
  }

  // ----- 9. 바퀴 연기: 의자 아래에 깔리게 의자보다 먼저 그린다 -----
  // 남은 수명이 적을수록 투명해지고, 계산 부분에서 size를 키워서 퍼지며 사라진다
  for (const smoke of smokes) {
    ctx.fillStyle = "rgba(220, 220, 220, " + (0.5 * smoke.life / SMOKE_LIFE) + ")";
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.size, 0, Math.PI * 2);
    ctx.fill();
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
    if (cloud.y + r < viewTop || cloud.y - r > viewBottom) continue;   // 화면 밖이면 건너뛴다
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

  // 드리프트 중이면 의자 위에 "DRIFT!" 글자를 띄운다
  // 맵이 아니라 화면에 그려야 화면이 돌아가도 글자가 똑바로 보인다. 의자는 항상 화면의 (가운데, CAMERA_ANCHOR_Y) 근처에 있다
  if (isDrifting) {
    ctx.fillStyle = "#ffd84d";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.font = "bold italic 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("DRIFT!", SCREEN_WIDTH / 2, CAMERA_ANCHOR_Y - 45);   // 검은 테두리를 먼저 그려서
    ctx.fillText("DRIFT!", SCREEN_WIDTH / 2, CAMERA_ANCHOR_Y - 45);     // 어느 배경에서도 잘 보이게
  }

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

// ===== 트랙: 높이 y에서 길 가운데 선의 x =====
// TRACK의 두 점 사이에 y가 있으면, 두 점의 x 사이를 부드럽게(코사인 곡선) 이어서 계산한다
// 그냥 직선으로 이으면 점마다 길이 뚝 꺾이지만, 코사인으로 이으면 휘어지는 시작과 끝이 둥글다
function roadCenterX(y) {
  if (y >= TRACK[0].y) return TRACK[0].x;
  for (let i = 0; i < TRACK.length - 1; i++) {
    const below = TRACK[i];        // 아래쪽 점 (y가 더 크다)
    const above = TRACK[i + 1];    // 위쪽 점
    if (y <= below.y && y >= above.y) {
      const t = (below.y - y) / (below.y - above.y);       // 아래 점에서 0, 위 점에서 1
      const smooth = (1 - Math.cos(Math.PI * t)) / 2;      // 0 → 1로 가되 처음과 끝은 천천히
      return below.x + (above.x - below.x) * smooth;
    }
  }
  return TRACK[TRACK.length - 1].x;
}

// ===== 트랙: 높이 y에서 길이 얼마나 기울었나 =====
// 아래로 1픽셀 갈 때 길 가운데가 옆으로 몇 픽셀 움직이는가 (0 = 똑바로 위아래, 1 = 45도)
function roadSlope(y) {
  return (roadCenterX(y + 1) - roadCenterX(y - 1)) / 2;
}

// ===== 이 위치가 잔디 위인가 (차도·인도를 벗어났는가) =====
function isOnGrass(x, y) {
  return Math.abs(x - roadCenterX(y)) > ROAD_HALF + SIDEWALK_WIDTH;
}

// ===== 길을 따라 휘는 띠 하나 칠하기 =====
// 길 가운데 선에서 fromOffset ~ toOffset만큼 떨어진 띠를, yTop부터 yBottom까지 칠한다
// 왼쪽 끝을 위에서 아래로 따라 내려간 뒤, 오른쪽 끝을 아래에서 위로 거슬러 올라오면 띠 모양 다각형이 된다
function fillTrackBand(fromOffset, toOffset, yTop, yBottom) {
  ctx.beginPath();
  for (let y = yTop; y <= yBottom; y += TRACK_STEP) {
    ctx.lineTo(roadCenterX(y) + fromOffset, y);
  }
  for (let y = yBottom; y >= yTop; y -= TRACK_STEP) {
    ctx.lineTo(roadCenterX(y) + toOffset, y);
  }
  ctx.closePath();
  ctx.fill();
}

// ===== 자동차 그리기 =====
// side: 1 = 오른쪽 차선, -1 = 왼쪽 차선 / topY: 자동차 위쪽 끝 y / goingDown: 아래로 가는 차인가
// 자동차는 자기 차선을 따라가고, 길이 휜 만큼 몸을 돌린다
function drawCar(side, topY, goingDown) {
  const centerY = topY + CAR_HEIGHT / 2;
  const centerX = roadCenterX(centerY) + side * LANE_OFFSET;
  // 자동차 그림은 앞이 위쪽이다. 위로 가는 차는 길 기울기만큼만, 아래로 가는 차는 180도 더 돌린다
  let angle = Math.atan(-roadSlope(centerY));
  if (goingDown) {
    angle = angle + Math.PI;
  }

  // save → 자동차 중심으로 붓을 옮기고 돌린다 → 그린다 → restore로 붓을 원래대로
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  // 돌린 붓 안에서는 자동차 앞이 항상 위쪽이라, 전조등은 앞 범퍼(-CAR_HEIGHT / 2)에서 위로(-1) 뻗는다
  // 자동차보다 먼저 그려서 빛이 차 밑에서 앞으로 뻗어 나오는 것처럼 보이게 한다
  drawHeadlights(0, -CAR_HEIGHT / 2, -1);
  ctx.drawImage(carImage, -CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
  ctx.restore();
}

// ===== 맵 꾸미기: 나무·풀·학생·구름 배치 (시작할 때 한 번) =====
// 길은 휘어 있으니 자리를 손으로 정하지 않고, 높이마다 길 바깥 잔디가 얼마나 남는지 재서 놓는다
function placeScenery() {
  // 나무: TREE_GAP마다 양쪽 잔디에 두 그루씩. 나무 높이 전체에서 길과 안 겹치는 자리에만 놓는다
  for (let y = BUILDING_HEIGHT + 30; y < WORLD_HEIGHT - TREE_SIZE; y += TREE_GAP) {
    // 나무가 차지하는 높이(위·가운데·아래)에서 길 바깥 끝을 재서, 가장 길에 가까운 곳 기준으로 놓는다
    let leftEdge = WORLD_RIGHT;   // 왼쪽 잔디가 끝나는 x (여기부터 오른쪽은 인도)
    let rightEdge = WORLD_LEFT;   // 오른쪽 잔디가 시작하는 x
    for (const dy of [0, TREE_SIZE / 2, TREE_SIZE]) {
      const center = roadCenterX(y + dy);
      leftEdge = Math.min(leftEdge, center - ROAD_HALF - SIDEWALK_WIDTH);
      rightEdge = Math.max(rightEdge, center + ROAD_HALF + SIDEWALK_WIDTH);
    }
    for (let i = 0; i < 2; i++) {
      // 길에서 8 ~ 360픽셀 떨어진 곳에 놓는다. 맵 끝 바깥으로 나가면 건너뛴다
      const leftX = leftEdge - 8 - TREE_SIZE - Math.random() * 352;
      if (leftX >= WORLD_LEFT) {
        trees.push({ x: leftX, y: y + Math.random() * 40 });
      }
      const rightX = rightEdge + 8 + Math.random() * 352;
      if (rightX + TREE_SIZE <= WORLD_RIGHT) {
        trees.push({ x: rightX, y: y + Math.random() * 40 });
      }
    }
  }

  // 풀 포기: TUFT_GAP마다 양쪽 잔디에 세 개씩, 길에서 16 ~ 380픽셀 떨어진 곳에
  for (let y = BUILDING_HEIGHT + 30; y < WORLD_HEIGHT; y += TUFT_GAP) {
    const tuftY = y + Math.random() * TUFT_GAP;
    // 풀잎 뿌리(tuftY)와 끝(tuftY - 풀잎 길이) 두 높이에서 길 바깥 끝을 재서 길에 더 가까운 쪽 기준으로 놓는다
    const leftEdge = Math.min(roadCenterX(tuftY), roadCenterX(tuftY - GRASS_BLADE_HEIGHT)) - ROAD_HALF - SIDEWALK_WIDTH;
    const rightEdge = Math.max(roadCenterX(tuftY), roadCenterX(tuftY - GRASS_BLADE_HEIGHT)) + ROAD_HALF + SIDEWALK_WIDTH;
    for (let i = 0; i < 3; i++) {
      const leftX = leftEdge - 16 - Math.random() * 364;
      if (leftX >= WORLD_LEFT + 8) {
        grassTufts.push({ x: leftX, y: tuftY });
      }
      const rightX = rightEdge + 16 + Math.random() * 364;
      if (rightX <= WORLD_RIGHT - 8) {
        grassTufts.push({ x: rightX, y: tuftY });
      }
    }
  }

  // 학생: STUDENT_GAP마다 한 명씩, 왼쪽·오른쪽 인도를 번갈아. 출발 지점 근처는 비워 둔다
  let side = -1;
  for (let y = 400; y < WORLD_HEIGHT - 500; y += STUDENT_GAP) {
    const speed = 0.5 + Math.random() * 0.4;                 // 0.5 ~ 0.9
    students.push({
      x: 0,                                                  // x는 게임 루프에서 길을 따라 계산한다
      y: y + Math.random() * STUDENT_WALK_RANGE,
      speedY: Math.random() < 0.5 ? speed : -speed,          // 절반은 위로, 절반은 아래로
      minY: y,
      maxY: y + STUDENT_WALK_RANGE,
      side: side,
    });
    side = -side;   // 다음 학생은 반대쪽 인도
  }

  // 구름: 화면 반 장마다 하나씩 (맵이 넓어서), 가로 위치·속도·크기는 제각각
  for (let y = 260; y < WORLD_HEIGHT; y += SCREEN_HEIGHT / 2) {
    clouds.push({
      x: WORLD_LEFT + Math.random() * (WORLD_RIGHT - WORLD_LEFT),
      y: y + Math.random() * 200,
      speedX: 0.2 + Math.random() * 0.2,
      size: 0.7 + Math.random() * 0.3,
    });
  }
}

// ===== 각도 차이 계산 =====
// 각도 a에서 b를 뺀 차이를 -180~180도(-π~π) 사이로 맞춰 준다
// 예: 350도와 10도의 차이를 340도가 아니라 -20도로 계산해서, 더 가까운 쪽으로 돌게 한다
function angleDiff(a, b) {
  const diff = a - b;
  return Math.atan2(Math.sin(diff), Math.cos(diff));
}

// ===== 의자 뒷바퀴 위치 =====
// 의자 그림의 뒷바퀴 두 개는 의자 중심에서 좌우로 14, 뒤로 22 떨어져 있다
// 의자가 chairAngle만큼 돌아가 있으니, 그 위치도 같이 돌려서 맵 좌표로 바꾼다
function getRearWheels() {
  const centerX = chairX + CHAIR_SIZE / 2;
  const centerY = chairY + CHAIR_SIZE / 2;
  const cos = Math.cos(chairAngle);
  const sin = Math.sin(chairAngle);
  const wheels = [];
  for (const side of [-14, 14]) {          // 왼쪽 바퀴(-14), 오른쪽 바퀴(14)
    const back = 22;                       // 뒤쪽(그림의 아래쪽)으로 22
    wheels.push({
      x: centerX + side * cos - back * sin,
      y: centerY + side * sin + back * cos,
    });
  }
  return wheels;
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
