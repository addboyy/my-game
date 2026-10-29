const canvas = document.getElementById("game");  // 이름이 "game"인 도화지를 찾는다
const ctx = canvas.getContext("2d");             // 그 도화지에 그릴 "붓"을 가져온다

// ===== 좌표와 크기 (여기 숫자만 바꾸면 그림이 바뀐다) =====
// 화면 크기: 가로 800, 세로 600. (0, 0)은 왼쪽 위, y가 커지면 아래로 간다.
// 맵은 화면보다 훨씬 넓다. 아래 좌표들은 전부 "맵 위의 좌표"다.

// ===== 카메라 (추격 시점) =====
// 화면은 맵의 일부만 비추는 카메라다. 카메라는 의자 뒤에 붙어서, 의자가 도는 대로 같이 돈다.
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const CAMERA_ANCHOR_Y = 430;                // 의자가 화면에서 머무르는 높이 (가로는 한가운데). 아래쪽이라 앞이 넓게 보인다
const CAMERA_TURN_FOLLOW = 0.04;            // 카메라가 의자 방향을 따라 도는 빠르기 (0~1). 작을수록 늦게, 부드럽게 따라 돈다
const CAMERA_ZOOM = 0.7;                    // 화면 확대 배율 (1 = 원래 크기). 작을수록 카메라가 멀어져서 넓게 보인다
const VIEW_RADIUS = 650 / CAMERA_ZOOM;      // 화면이 돌아가도 보일 수 있는 의자 주변 범위 (이 밖은 그리지 않는다)
let cameraAngle = 0;                        // 카메라가 바라보는 방향 (0 = 맵 위쪽)

// ===== 트랙 (카트라이더 "빌리지 고가의 질주" 느낌: 긴 직선 + 직각 코너 + 헤어핀 + 고가도로) =====
// 길 가운데 선이 지나가는 꼭짓점들. 출발부터 강의실(결승)까지 순서대로 직선으로 잇고,
// 꼭짓점마다 모서리를 CORNER_RADIUS만큼 둥글게 깎는다.
// bridge: true인 점에서 다음 점까지의 직선은 고가도로다 (다른 길 위를 지나간다)
const TRACK_POINTS = [
  { x: 0, y: 400 },                      // 출발 (출발선 뒤 여유 공간)
  { x: 0, y: -2500 },                    // 첫 긴 직선 → 오른쪽으로 직각
  { x: 1800, y: -2500 },                 // → 아래로 직각
  { x: 1800, y: -1200, bridge: true },   // 여기서 시작하는 긴 직선이 고가도로. 첫 직선 위를 가로지른다
  { x: -1000, y: -1200 },                // 고가에서 내려와 위로 직각
  { x: -1000, y: -4000 },                // 긴 직선 → 오른쪽으로 직각
  { x: 600, y: -4000 },                  // 헤어핀 시작: 아래로 꺾어 내려갔다가
  { x: 600, y: -3200 },
  { x: 1500, y: -3200 },                 // 옆으로 건너가서 다시 위로 (U자로 되돌아가기)
  { x: 1500, y: -5000 },                 // 긴 직선 → 왼쪽으로 직각
  { x: 0, y: -5000 },                    // → 위로 직각
  { x: 0, y: -6000 },                    // 강의실 앞 (결승)
];
const CORNER_RADIUS = 350;    // 꼭짓점 모서리를 깎는 길이. 클수록 코너가 완만하다
const TRACK_STEP = 8;         // 트랙을 몇 픽셀마다 점으로 나눠 둘지 (작을수록 매끄럽지만 느리다)

// 길 단면: 왼쪽부터 잔디 → 인도 → 차도 → 인도 → 잔디 (전부 길 가운데 선에서 떨어진 거리)
const ROAD_HALF = 230;        // 차도 반폭 (차도 전체 폭 460)
const SIDEWALK_WIDTH = 60;    // 양쪽 인도 폭 (학생 어깨 폭 52가 들어가게)
const LANE_OFFSET = 115;      // 자동차 차선 가운데가 길 가운데 선에서 떨어진 거리
const GRASS_SPEED_RATE = 0.5; // 잔디 위에서는 최고 속도가 이 비율로 줄어든다 (길을 벗어나면 느려진다)
const BRIDGE_SHADOW = 30;     // 고가도로 그림자가 땅에 비치는 거리 (높이 있어 보이게)
const START_LINE_S = 400;     // 출발선 위치 (트랙 시작에서 달린 거리)

// 트랙을 TRACK_STEP 간격의 점들로 나눠 둔다: { x, y, s(시작부터 거리), tx, ty(진행 방향), bridge }
const trackSamples = buildTrack();
const TRACK_LENGTH = trackSamples[trackSamples.length - 1].s;   // 트랙 전체 길이
const FINISH = trackSamples[trackSamples.length - 1];          // 결승 지점 (강의실 문 앞)

// 맵 크기: 트랙을 둘러싸고 잔디를 넉넉히. 맵 위쪽 끝은 강의실 건물
const WORLD_LEFT = Math.min(...TRACK_POINTS.map(p => p.x)) - 900;
const WORLD_RIGHT = Math.max(...TRACK_POINTS.map(p => p.x)) + 900;
const WORLD_BOTTOM = Math.max(...TRACK_POINTS.map(p => p.y)) + 600;
const WORLD_TOP = FINISH.y;   // 강의실 건물 아래쪽 끝 (여기보다 위로는 못 간다)

// 나무와 풀: 시작할 때 길을 피해 잔디 위에 자동으로 배치한다 (아래 placeScenery 함수)
const TREE_SIZE = 80;
let trees = [];               // { x, y } 이미지의 왼쪽 위 꼭짓점
let grassTufts = [];          // { x, y } 풀 뿌리 위치
const TREE_COUNT = 450;       // 나무를 놓아 볼 횟수 (길과 겹치는 자리는 버려서 실제로는 더 적다)
const TUFT_COUNT = 3000;      // 풀 포기를 놓아 볼 횟수
const GRASS_BLADE_HEIGHT = 18;   // 풀잎 길이
const GRASS_SWAY = 4;            // 풀잎 끝이 좌우로 흔들리는 최대 거리
let swayTime = 0;                // 흔들림 시계: 매 프레임 조금씩 커진다
const SWAY_SPEED = 0.05;         // 흔들리는 빠르기 (클수록 빨리 흔들린다)
const TREE_SWAY_ANGLE = 0.04;    // 나무가 좌우로 기우는 최대 각도 (0.04 ≈ 2도)

// 구름 그림자: 하늘의 구름이 땅에 드리운 반투명 그림자가 천천히 가로지른다 (size는 크기 배율, 1 = 기본)
let clouds = [];
const CLOUD_COUNT = 30;
const CLOUD_RADIUS = 110;        // 구름 그림자 가로 반지름 (size가 1일 때)

// 플레이어(의자): 50×50, 출발선 뒤에서 출발한다
// 방향키로 움직이므로 위치는 let (chairX, chairY는 왼쪽 위 꼭짓점)
const CHAIR_SIZE = 50;
const chairStart = pointAt(START_LINE_S - 150);
let chairX = chairStart.x - CHAIR_SIZE / 2;
let chairY = chairStart.y - CHAIR_SIZE / 2;

// 의자가 지금 트랙의 어디쯤인가 (매 프레임 updateChairTrack이 계산한다)
let chairTrackIndex = 0;      // 가장 가까운 트랙 점 번호
let chairS = 0;               // 트랙 시작에서 달린 거리 (자동차를 의자 근처에 다시 나타나게 할 때 쓴다)
let chairOnRoad = true;       // 길(차도·인도) 위인가 (아니면 잔디)
let chairOnBridge = false;    // 고가도로 위인가 (고가 아래를 지날 때와 그리는 순서가 달라진다)

// ===== 조작 설정 (여기 숫자를 바꿔 가며 조작 느낌을 튜닝한다) =====
const CHAIR_SPEED = 9;        // 이동 속도: 한 프레임에 움직이는 픽셀 수 (최고 속도)
const GRIP = 0.25;            // 평소 접지력 (0~1): 클수록 키를 누른 방향으로 바로 꺾이고 바로 선다
const DRIFT_GRIP = 0.03;      // Shift 드리프트 중 접지력: 작을수록 관성이 커서 옆으로 오래 미끄러진다
const TURN_RATE = 0.05;       // ← → 키로 한 프레임에 도는 각도 (라디안, 0.05 ≈ 3도)
const REVERSE_SPEED_RATE = 0.5;  // ↓ 키로 뒤로 갈 때는 최고 속도의 이 비율만큼만

let chairVX = 0;              // 의자의 지금 가로 속도 (양수 = 오른쪽)
let chairVY = 0;              // 의자의 지금 세로 속도 (양수 = 아래)
let chairAngle = Math.atan2(chairStart.tx, -chairStart.ty);   // 의자가 바라보는 방향 (0 = 위쪽). 처음엔 트랙 진행 방향

// ===== 드리프트 연출 =====
const DRIFT_TURN_RATE = 0.08; // 드리프트 중에는 더 빨리 돈다 → 몸은 휙 돌고 몸통은 원래 방향으로 미끄러진다
const DRIFT_MIN_SPEED = 1.5;  // 이 속도보다 느리면 드리프트 연출(자국, 연기)을 하지 않는다
let isDrifting = false;       // 지금 드리프트로 미끄러지는 중인가 (연출을 켜고 끄는 데 쓴다)

// 스키드 마크: 뒷바퀴가 지나간 자리에 남는 타이어 자국 (짧은 선분들의 목록)
// 선분마다 { x1, y1, x2, y2, life, bridge }. life가 줄어들수록 흐려지고 0이 되면 지운다
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
// 학생들은 차도가 아니라 양쪽 인도 위를 따라 걷는다 (차는 차도, 사람은 인도). 고가도로 위에는 없다
// 학생마다 자기 구간(minS ~ maxS, 트랙 거리)만 오가다가 끝에 닿으면 돌아선다
// side는 어느 쪽 인도인지 (-1 = 진행 방향 왼쪽, 1 = 오른쪽)
let students = [];
const STUDENT_GAP = 700;      // 학생을 놓을 트랙 거리 간격
const STUDENT_WALK_RANGE = 260;  // 한 학생이 오가는 구간 길이
const STUDENT_WOBBLE = 0.12;  // 걸을 때 몸이 좌우로 흔들리는 각도 (0.12 ≈ 7도)

// 자동차: 40×70, 트랙을 따라 자기 차선으로 달린다. 위치는 트랙 거리(s)로 기억한다
const CAR_WIDTH = 40;
const CAR_HEIGHT = 70;
// 자동차 1: 의자와 같은 방향(오른쪽 차선)으로 달린다. 의자보다 조금 느려서 따라잡을 수 있다
let carS = 1800;
let carSpeed = 7;         // 한 프레임에 트랙을 따라 7씩 앞으로
// 자동차 2: 반대 방향 차선으로 마주 온다
let car2S = 3500;
let car2Speed = -6;       // 한 프레임에 트랙을 거슬러 6씩 (음수 = 결승 → 출발 방향)
const CAR_RESPAWN_AHEAD = 2500;   // 자동차가 멀어지면 의자보다 이만큼 앞에 다시 나타난다
const CAR_RESPAWN_BEHIND = 1500;  // 의자보다 이만큼 뒤로 처지면 다시 나타나게 한다
const CAR_INSIDE_BUILDING = 150;  // 결승을 지나 이만큼 더 가면 강의실 건물 안에 완전히 가려진다

// 자동차 전조등: 자동차 앞쪽으로 뻗는 노란 반투명 빛
const HEADLIGHT_LENGTH = 45;  // 빛이 뻗는 길이

// 강의실 건물과 문: 결승 지점 바로 위. 문은 결승 지점 가운데에 붙어 있다
const BUILDING_WALL_HEIGHT = 100;   // 문 위로 보이는 건물 벽 높이 (창문이 있는 부분)
const DOOR_WIDTH = 120;
const DOOR_HEIGHT = 40;
const DOOR_X = FINISH.x - DOOR_WIDTH / 2;
const DOOR_Y = WORLD_TOP - DOOR_HEIGHT;

// 미니맵: 화면 오른쪽 위에 트랙 전체를 작게 (위쪽이 맵 위쪽, 돌아가지 않는다)
const MINIMAP_SIZE = 150;
const MINIMAP_X = SCREEN_WIDTH - MINIMAP_SIZE - 12;
const MINIMAP_Y = 12;

// 남은 시간 글자: 화면 위 가운데
let timeLeft = 90;        // 남은 시간(초). 1초마다 1씩 줄어든다
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
    if (!chairOnRoad) {
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
  if (chairY < WORLD_TOP) {
    chairY = WORLD_TOP;
    chairVY = 0;
  }
  if (chairY > WORLD_BOTTOM - CHAIR_SIZE) {
    chairY = WORLD_BOTTOM - CHAIR_SIZE;
    chairVY = 0;
  }

  // 의자가 트랙의 어디쯤인지, 길 위인지, 고가 위인지 알아낸다
  updateChairTrack();

  // 드리프트 연출: 뒷바퀴 자리에 스키드 마크와 연기를 남긴다
  if (isDrifting) {
    const wheels = getRearWheels();
    if (lastWheels !== null) {
      // 직전 바퀴 위치 → 지금 바퀴 위치를 잇는 짧은 선을 바퀴마다 하나씩 남긴다 (고가 위 자국인지도 기억)
      for (let i = 0; i < 2; i++) {
        skidMarks.push({ x1: lastWheels[i].x, y1: lastWheels[i].y, x2: wheels[i].x, y2: wheels[i].y, life: SKID_LIFE, bridge: chairOnBridge });
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

  // 카메라가 의자 뒤에서 의자가 바라보는 방향으로 천천히 따라 돈다
  // 한 번에 다 돌지 않고 차이의 일부만 돌아서, 드리프트할 때 화면이 덜덜 떨리지 않고 부드럽게 돈다
  cameraAngle = cameraAngle + angleDiff(chairAngle, cameraAngle) * CAMERA_TURN_FOLLOW;
  const chairCenterX = chairX + CHAIR_SIZE / 2;
  const chairCenterY = chairY + CHAIR_SIZE / 2;

  // 자동차 1을 트랙을 따라 앞으로 옮긴다. 결승을 지나면 강의실 건물 안으로 들어가 가려진다
  // 의자보다 한참 뒤로 처지거나 건물 안으로 다 들어가면, 의자보다 앞쪽에 다시 나타난다
  // 단, 의자가 결승 근처라 앞쪽 자리가 트랙 밖이면, 의자 뒤쪽(화면 밖)에 다시 놓는다
  carS = carS + carSpeed;
  if (carS < chairS - CAR_RESPAWN_BEHIND || carS > TRACK_LENGTH + CAR_INSIDE_BUILDING) {
    if (chairS + CAR_RESPAWN_AHEAD < TRACK_LENGTH) {
      carS = chairS + CAR_RESPAWN_AHEAD;
    } else {
      carS = chairS - CAR_RESPAWN_BEHIND + 200;
    }
  }

  // 흔들림 시계를 조금 앞으로 돌린다 (풀잎 흔들림에 쓴다)
  swayTime = swayTime + SWAY_SPEED;

  // 자동차 2를 트랙을 거슬러 옮긴다 (속도가 음수라 s가 줄어든다)
  // 의자 뒤로 지나가 버리면, 다시 의자 앞쪽에서 마주 오게 한다
  // 앞쪽 자리가 트랙 끝을 넘으면 강의실 건물 안에서 출발해서, 건물에서 나오는 것처럼 보이게 한다
  car2S = car2S + car2Speed;
  if (car2S < chairS - CAR_RESPAWN_BEHIND || car2S < 0) {
    car2S = Math.min(chairS + CAR_RESPAWN_AHEAD, TRACK_LENGTH + CAR_INSIDE_BUILDING);
  }

  // 학생들을 인도 위에서 걷는 속도만큼 옮기고, 자기 구간 끝에 닿으면 방향을 뒤집는다
  for (const student of students) {
    student.s = student.s + student.speed;
    if (student.s > student.maxS || student.s < student.minS) {
      student.speed = -student.speed;
    }
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

  // 카메라 (추격 시점): 네 단계로 붓을 옮긴다. 아래에서부터 거꾸로 읽으면 이해하기 쉽다
  //   ④ 의자 중심이 (0, 0)에 오게 맵을 민다
  //   ③ CAMERA_ZOOM만큼 맵을 작게 줄인다 → 카메라가 멀리서 보는 것처럼 넓게 보인다
  //   ② 카메라 각도만큼 맵을 반대로 돌린다 → 의자가 바라보는 쪽이 화면 위쪽이 된다
  //   ① (0, 0)을 화면 가운데 아래(의자 자리)로 옮긴다
  // 여기부터 restore 전까지는 전부 "맵 위의 좌표"로 그린다
  ctx.save();
  ctx.translate(SCREEN_WIDTH / 2, CAMERA_ANCHOR_Y);   // ①
  ctx.rotate(-cameraAngle);                           // ②
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);                // ③
  ctx.translate(-chairCenterX, -chairCenterY);        // ④

  // 화면이 돌아가 있어서, 의자 주변 VIEW_RADIUS 안은 어느 방향이든 보일 수 있다
  const viewLeft = chairCenterX - VIEW_RADIUS;
  const viewTop = chairCenterY - VIEW_RADIUS;

  // ----- 1. 잔디 (보이는 범위 전체 바닥) -----
  // [새로 시도] 패턴: 작은 잔디 그림을 타일처럼 반복해서 칠한다. 길은 이 위에 덮어 그린다
  ctx.fillStyle = ctx.createPattern(grassImage, "repeat");
  ctx.fillRect(viewLeft, viewTop, VIEW_RADIUS * 2, VIEW_RADIUS * 2);

  // 풀 포기: 포기마다 풀잎 3개. 끝부분이 sin(사인) 물결처럼 좌우로 흔들린다
  // 포기마다 위치를 더해서 흔들리는 타이밍을 다르게 → 바람이 지나가는 것처럼 보인다
  ctx.strokeStyle = "#2f7d32";
  ctx.lineWidth = 2;
  for (const tuft of grassTufts) {
    if (!isNearChair(tuft.x, tuft.y, 0)) continue;   // 화면 밖이면 건너뛴다
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

  // ----- 2. 땅 위 도로 (인도 + 차도 + 차선) -----
  drawRoad(false);

  // ----- 3. 출발선: 체크무늬 띠 -----
  drawAcrossRoad(START_LINE_S, function () {
    let col = 0;   // 몇 번째 칸인가 (흰색·검은색을 번갈아 칠하려고 센다)
    for (let x = -ROAD_HALF; x < ROAD_HALF; x += 20) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = (col + row) % 2 === 0 ? "#ffffff" : "#222222";
        ctx.fillRect(x, -20 + row * 20, 20, 20);
      }
      col = col + 1;
    }
  });

  // ----- 4. 횡단보도: 강의실 앞, 흰 줄무늬 -----
  drawAcrossRoad(TRACK_LENGTH - 120, function () {
    ctx.fillStyle = "#ffffff";
    for (let x = -ROAD_HALF + 20; x < ROAD_HALF - 20; x += 40) {
      ctx.fillRect(x, -20, 20, 40);
    }
  });

  // ----- 스키드 마크 (땅 위 자국): 땅바닥에 붙은 자국이라 도로 바로 위, 나머지 모든 것 아래에 -----
  drawSkidMarks(false);

  // ----- 5. 나무 (잔디 위): 풀과 같은 흔들림 시계로 살짝 기울었다 돌아온다 -----
  for (const tree of trees) {
    if (!isNearChair(tree.x, tree.y, TREE_SIZE)) continue;   // 화면 밖이면 건너뛴다
    const angle = Math.sin(swayTime * 0.8 + tree.y * 0.02) * TREE_SWAY_ANGLE;
    ctx.save();
    ctx.translate(tree.x + TREE_SIZE / 2, tree.y + TREE_SIZE / 2);   // 나무 중심으로 붓을 옮긴다
    ctx.rotate(angle);                                              // 그 자리에서 살짝 돌린다
    ctx.drawImage(treeImage, -TREE_SIZE / 2, -TREE_SIZE / 2, TREE_SIZE, TREE_SIZE);
    ctx.restore();
  }

  // ----- 6. 다른 학생들 (인도 위): 걷는 쪽을 보고, 걸음마다 몸이 좌우로 흔들린다 -----
  for (const student of students) {
    const p = pointAt(student.s);
    const x = p.x - p.ty * student.side * (ROAD_HALF + SIDEWALK_WIDTH / 2);   // 인도 한가운데
    const y = p.y + p.tx * student.side * (ROAD_HALF + SIDEWALK_WIDTH / 2);
    if (!isNearChair(x, y, STUDENT_WIDTH)) continue;
    // 학생 그림은 아래쪽을 보고 있다. 걷는 방향(트랙 방향 또는 그 반대)으로 돌린다
    let dirX = p.tx;
    let dirY = p.ty;
    if (student.speed < 0) {
      dirX = -dirX;
      dirY = -dirY;
    }
    const facing = Math.atan2(-dirX, dirY);
    // 걸음 흔들림: s(걸어온 거리)로 계산하므로 걸을 때만 흔들린다
    const wobble = Math.sin(student.s * 0.3) * STUDENT_WOBBLE;

    ctx.save();
    ctx.translate(x, y);   // 학생 중심으로 붓을 옮긴다
    ctx.rotate(facing + wobble);
    // 중심 기준으로 그리기 위해 가로·세로의 반만큼 빼서 그린다
    ctx.drawImage(studentImage, -STUDENT_WIDTH / 2, -STUDENT_HEIGHT / 2, STUDENT_WIDTH, STUDENT_HEIGHT);
    ctx.restore();
  }

  // ----- 7. 땅 위의 자동차와 의자 (고가 아래를 지나는 중이면 고가보다 먼저 그려서 고가에 가려지게) -----
  drawCar(carS, 1, true, false);     // 오른쪽 차선, 앞으로 가는 차
  drawCar(car2S, -1, false, false);  // 반대편 차선, 마주 오는 차
  if (!chairOnBridge) drawChair();

  // ----- 8. 고가도로: 그림자 → 난간 → 도로 순서로, 땅 위 모든 것 위에 -----
  drawRoad(true);
  drawSkidMarks(true);
  drawCar(carS, 1, true, true);
  drawCar(car2S, -1, false, true);
  if (chairOnBridge) drawChair();

  // ----- 9. 바퀴 연기 -----
  // 남은 수명이 적을수록 투명해지고, 계산 부분에서 size를 키워서 퍼지며 사라진다
  for (const smoke of smokes) {
    ctx.fillStyle = "rgba(220, 220, 220, " + (0.5 * smoke.life / SMOKE_LIFE) + ")";
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // ----- 10. 강의실 건물 (결승 지점 위) -----
  // 화면이 돌면 맵 끝 바깥과 건물 뒤쪽도 보이므로, 건물을 바깥까지 넉넉히 칠한다
  ctx.fillStyle = "#9c4a3a";
  ctx.fillRect(WORLD_LEFT - VIEW_RADIUS, WORLD_TOP - VIEW_RADIUS * 2, WORLD_RIGHT - WORLD_LEFT + VIEW_RADIUS * 2, VIEW_RADIUS * 2);

  // 건물 지붕 끝선: 아래쪽에 진한 띠
  ctx.fillStyle = "#6e2f24";
  ctx.fillRect(WORLD_LEFT - VIEW_RADIUS, WORLD_TOP - 8, WORLD_RIGHT - WORLD_LEFT + VIEW_RADIUS * 2, 8);

  // 창문: 하늘색 사각형을 일정한 간격으로 (문 자리는 비운다)
  ctx.fillStyle = "#a8dadc";
  for (let x = WORLD_LEFT + 30; x < WORLD_RIGHT; x += 90) {
    if (x > DOOR_X - 60 && x < DOOR_X + DOOR_WIDTH) {
      continue;   // 문이 있는 자리에는 창문을 그리지 않는다
    }
    ctx.fillRect(x, WORLD_TOP - 45, 50, 26);
  }

  // ----- 11. 강의실 문 (도착 지점) -----
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

  // ----- 구름 그림자 (땅 위 모든 것 위에, 글자·게이지 아래에) -----
  // 타원 3개를 겹쳐서 뭉게구름 모양을 만든다
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  for (const cloud of clouds) {
    const r = CLOUD_RADIUS * cloud.size;
    if (!isNearChair(cloud.x, cloud.y, r)) continue;   // 화면 밖이면 건너뛴다
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
    ctx.strokeText("DRIFT!", SCREEN_WIDTH / 2, CAMERA_ANCHOR_Y - 35);   // 검은 테두리를 먼저 그려서
    ctx.fillText("DRIFT!", SCREEN_WIDTH / 2, CAMERA_ANCHOR_Y - 35);     // 어느 배경에서도 잘 보이게
  }

  // ----- 미니맵 (화면 오른쪽 위) -----
  drawMinimap();

  // ----- 12. 글자: 남은 시간 (화면 위 가운데) -----
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

  // ----- 13. 부스터 게이지 (화면 아래 가운데) -----
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
  ctx.lineWidth = 1;
  ctx.strokeRect(GAUGE_X, GAUGE_Y, GAUGE_WIDTH, GAUGE_HEIGHT);

  // ===== ④ 다음 프레임 예약: 다음 그림 때 gameLoop를 또 불러 달라고 부탁한다 =====
  requestAnimationFrame(gameLoop);
}

// ===== 트랙 만들기: TRACK_POINTS를 TRACK_STEP 간격의 점들로 나눈다 (시작할 때 한 번) =====
// 꼭짓점과 꼭짓점 사이는 직선, 꼭짓점 근처는 모서리를 깎은 곡선(2차 베지어)으로 잇는다
function buildTrack() {
  const samples = [];

  // 점 하나를 목록에 넣는다. 직전 점과의 거리를 더해서 s(시작부터 거리)를 기록한다
  function addSample(x, y, bridge) {
    let s = 0;
    if (samples.length > 0) {
      const last = samples[samples.length - 1];
      s = last.s + Math.hypot(x - last.x, y - last.y);
    }
    samples.push({ x: x, y: y, s: s, tx: 0, ty: -1, bridge: bridge });
  }

  const n = TRACK_POINTS.length;
  for (let i = 0; i < n - 1; i++) {
    const a = TRACK_POINTS[i];
    const b = TRACK_POINTS[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const dirX = (b.x - a.x) / length;
    const dirY = (b.y - a.y) / length;

    // 직선 부분: 처음과 끝 꼭짓점이 아니면 양쪽 끝을 CORNER_RADIUS만큼 남겨 둔다 (그 자리는 곡선이 차지한다)
    const startCut = i === 0 ? 0 : CORNER_RADIUS;
    const endCut = i === n - 2 ? 0 : CORNER_RADIUS;
    for (let d = startCut; d <= length - endCut; d += TRACK_STEP) {
      addSample(a.x + dirX * d, a.y + dirY * d, a.bridge === true);
    }

    // 꼭짓점 b의 모서리 곡선: 들어오는 직선 끝 → b 근처 → 나가는 직선 시작
    if (i < n - 2) {
      const c = TRACK_POINTS[i + 2];
      const nextLength = Math.hypot(c.x - b.x, c.y - b.y);
      const fromX = b.x - dirX * CORNER_RADIUS;
      const fromY = b.y - dirY * CORNER_RADIUS;
      const toX = b.x + (c.x - b.x) / nextLength * CORNER_RADIUS;
      const toY = b.y + (c.y - b.y) / nextLength * CORNER_RADIUS;
      const steps = Math.ceil((CORNER_RADIUS * 1.6) / TRACK_STEP);
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        // 2차 베지어: 시작점, 조절점(꼭짓점), 끝점을 t 비율로 섞는다
        const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * b.x + t * t * toX;
        const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * b.y + t * t * toY;
        addSample(x, y, false);
      }
    }
  }

  // 각 점의 진행 방향(길이 1인 방향 벡터): 앞뒤 점을 잇는 방향
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const length = Math.hypot(next.x - prev.x, next.y - prev.y);
    samples[i].tx = (next.x - prev.x) / length;
    samples[i].ty = (next.y - prev.y) / length;
  }
  return samples;
}

// ===== 트랙 위의 한 지점: 시작에서 거리 s만큼 간 곳의 위치와 진행 방향 =====
function pointAt(s) {
  // s보다 처음으로 크거나 같은 점을 반씩 나눠 찾는다 (이진 탐색: 점이 많아도 빠르다)
  if (s <= 0) return trackSamples[0];
  if (s >= TRACK_LENGTH) return trackSamples[trackSamples.length - 1];
  let low = 0;
  let high = trackSamples.length - 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (trackSamples[mid].s < s) low = mid;
    else high = mid;
  }
  // 두 점 사이를 비율대로 섞는다
  const a = trackSamples[low];
  const b = trackSamples[high];
  const t = (s - a.s) / (b.s - a.s);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    tx: a.tx,
    ty: a.ty,
    bridge: a.bridge,
  };
}

// ===== 의자가 트랙의 어디쯤인지 알아낸다 =====
// 길 위의 점 중에서, 직전 프레임에 있던 곳과 이어지는 점을 고른다
// (고가와 그 아래 길이 겹치는 곳에서 "아래층인지 위층인지"를 헷갈리지 않으려고)
function updateChairTrack() {
  const cx = chairX + CHAIR_SIZE / 2;
  const cy = chairY + CHAIR_SIZE / 2;
  const roadLimit = (ROAD_HALF + SIDEWALK_WIDTH) * (ROAD_HALF + SIDEWALK_WIDTH);
  let nearest = 0;                // 제일 가까운 점
  let nearestDist = Infinity;
  let nearestOnRoad = -1;         // 길 안쪽이면서, 직전 위치와 이어지는 점 중 제일 가까운 점
  let nearestOnRoadDist = Infinity;
  let anyOnRoad = -1;             // 직전 위치와 안 이어져도 길 안쪽인 점 (잔디에서 다른 길로 들어왔을 때)

  for (let i = 0; i < trackSamples.length; i++) {
    const dx = trackSamples[i].x - cx;
    const dy = trackSamples[i].y - cy;
    const dist = dx * dx + dy * dy;   // 거리의 제곱 (비교만 하니 제곱근을 안 구해도 된다)
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = i;
    }
    if (dist <= roadLimit) {
      if (anyOnRoad < 0) anyOnRoad = i;
      if (Math.abs(i - chairTrackIndex) < 150 && dist < nearestOnRoadDist) {
        nearestOnRoadDist = dist;
        nearestOnRoad = i;
      }
    }
  }

  if (nearestOnRoad >= 0) {
    chairTrackIndex = nearestOnRoad;
    chairOnRoad = true;
  } else if (anyOnRoad >= 0) {
    chairTrackIndex = nearest;
    chairOnRoad = true;
  } else {
    chairTrackIndex = nearest;
    chairOnRoad = false;
  }
  chairS = trackSamples[chairTrackIndex].s;
  chairOnBridge = chairOnRoad && trackSamples[chairTrackIndex].bridge;
}

// ===== 이 위치가 의자 근처(화면에 보일 수 있는 범위)인가 =====
function isNearChair(x, y, margin) {
  const cx = chairX + CHAIR_SIZE / 2;
  const cy = chairY + CHAIR_SIZE / 2;
  return Math.abs(x - cx) < VIEW_RADIUS + margin && Math.abs(y - cy) < VIEW_RADIUS + margin;
}

// ===== 트랙 길 모양(경로) 만들기: 의자 근처의 땅 위(또는 고가) 부분만 =====
// 굵은 선으로 칠하면 길이 된다. 땅 길은 고가와 만나는 이음매가 벌어지지 않게 한 점씩 더 이어 그린다
function traceTrack(bridgeLevel) {
  ctx.beginPath();
  let drawing = false;   // 지금 선을 잇는 중인가 (끊겼으면 moveTo로 새로 시작)
  for (let i = 0; i < trackSamples.length; i++) {
    const p = trackSamples[i];
    let inLevel = p.bridge === bridgeLevel;
    if (!bridgeLevel) {
      const prev = trackSamples[Math.max(0, i - 1)];
      const next = trackSamples[Math.min(trackSamples.length - 1, i + 1)];
      inLevel = inLevel || prev.bridge === false || next.bridge === false;
    }
    if (inLevel && isNearChair(p.x, p.y, ROAD_HALF + SIDEWALK_WIDTH)) {
      if (drawing) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
      drawing = true;
    } else {
      drawing = false;
    }
  }
}

// ===== 도로 그리기 (땅 위 또는 고가) =====
// 같은 길 모양을 굵은 선부터 가는 선 순서로 겹쳐 칠한다: 인도 → 차도 → 흰 실선 → 다시 차도
// 그러면 흰 실선만 차도 가장자리에 가늘게 남는다
function drawRoad(bridgeLevel) {
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";

  if (bridgeLevel) {
    // 고가 그림자: 오른쪽 아래로 비켜서 반투명하게 → 떠 있어 보인다
    ctx.save();
    ctx.translate(BRIDGE_SHADOW, BRIDGE_SHADOW);
    traceTrack(true);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = (ROAD_HALF + SIDEWALK_WIDTH) * 2;
    ctx.stroke();
    ctx.restore();

    // 난간: 인도보다 조금 넓은 진한 회색 테두리
    traceTrack(true);
    ctx.strokeStyle = "#6b6b6b";
    ctx.lineWidth = (ROAD_HALF + SIDEWALK_WIDTH) * 2 + 16;
    ctx.stroke();
  }

  traceTrack(bridgeLevel);
  ctx.strokeStyle = "#bfbfbf";                    // 인도
  ctx.lineWidth = (ROAD_HALF + SIDEWALK_WIDTH) * 2;
  ctx.stroke();
  ctx.strokeStyle = "#4d4d4d";                    // 차도
  ctx.lineWidth = ROAD_HALF * 2;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";                    // 흰 실선 (차도 끝에서 6~10픽셀 안쪽)
  ctx.lineWidth = (ROAD_HALF - 6) * 2;
  ctx.stroke();
  ctx.strokeStyle = "#4d4d4d";
  ctx.lineWidth = (ROAD_HALF - 10) * 2;
  ctx.stroke();

  // 보도블록 줄 (40마다) 과 가운데 노란 점선 (50마다 30 길이): 트랙 방향에 맞춰 긋는다
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#a6a6a6";
  for (let s = 0; s < TRACK_LENGTH; s += 40) {
    const p = pointAt(s);
    if (p.bridge !== bridgeLevel || !isNearChair(p.x, p.y, ROAD_HALF + SIDEWALK_WIDTH)) continue;
    // 진행 방향에 수직인 방향(옆 방향)으로 인도 폭만큼 긋는다
    const sideX = -p.ty;
    const sideY = p.tx;
    ctx.beginPath();
    ctx.moveTo(p.x + sideX * ROAD_HALF, p.y + sideY * ROAD_HALF);
    ctx.lineTo(p.x + sideX * (ROAD_HALF + SIDEWALK_WIDTH), p.y + sideY * (ROAD_HALF + SIDEWALK_WIDTH));
    ctx.moveTo(p.x - sideX * ROAD_HALF, p.y - sideY * ROAD_HALF);
    ctx.lineTo(p.x - sideX * (ROAD_HALF + SIDEWALK_WIDTH), p.y - sideY * (ROAD_HALF + SIDEWALK_WIDTH));
    ctx.stroke();
  }

  ctx.lineWidth = 4;
  ctx.strokeStyle = "#f2c200";
  for (let s = START_LINE_S + 40; s < TRACK_LENGTH - 200; s += 50) {
    const p = pointAt(s);
    if (p.bridge !== bridgeLevel || !isNearChair(p.x, p.y, 50)) continue;
    const q = pointAt(s + 30);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
}

// ===== 트랙을 가로지르는 그림 그리기 (출발선, 횡단보도) =====
// 트랙 거리 s 지점으로 붓을 옮기고 진행 방향으로 돌린 뒤 drawFn을 부른다
// drawFn 안에서는 x가 길 가로 방향(-ROAD_HALF ~ ROAD_HALF), y가 진행 방향(음수 = 앞)이다
function drawAcrossRoad(s, drawFn) {
  const p = pointAt(s);
  if (!isNearChair(p.x, p.y, ROAD_HALF)) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.tx, -p.ty));
  drawFn();
  ctx.restore();
}

// ===== 스키드 마크 그리기 (땅 위 자국 또는 고가 위 자국) =====
// 남은 수명(life)이 적을수록 투명하게 그려서 서서히 사라지게 한다
function drawSkidMarks(bridgeLevel) {
  ctx.lineWidth = SKID_WIDTH;
  ctx.lineCap = "round";
  for (const mark of skidMarks) {
    if (mark.bridge !== bridgeLevel) continue;
    ctx.strokeStyle = "rgba(20, 20, 20, " + (0.45 * mark.life / SKID_LIFE) + ")";
    ctx.beginPath();
    ctx.moveTo(mark.x1, mark.y1);
    ctx.lineTo(mark.x2, mark.y2);
    ctx.stroke();
  }
  ctx.lineCap = "butt";   // 다른 선 그리기에 영향이 없게 원래대로
}

// ===== 플레이어 의자 그리기: 바라보는 방향(chairAngle)으로 돌려서 =====
function drawChair() {
  ctx.save();
  ctx.translate(chairX + CHAIR_SIZE / 2, chairY + CHAIR_SIZE / 2);   // 의자 중심으로 붓을 옮긴다
  ctx.rotate(chairAngle);
  ctx.drawImage(chairImage, -CHAIR_SIZE / 2, -CHAIR_SIZE / 2, CHAIR_SIZE, CHAIR_SIZE);
  ctx.restore();
}

// ===== 자동차 그리기 =====
// s: 트랙 거리 / lane: 1 = 진행 방향 오른쪽 차선, -1 = 왼쪽 차선 / forward: 트랙 방향으로 가는 차인가
// bridgeLevel: 지금 그리는 층 (그 층에 있는 차만 그린다)
function drawCar(s, lane, forward, bridgeLevel) {
  let p = pointAt(s);
  if (s > TRACK_LENGTH) {
    // 결승을 지난 차: 트랙 끝 방향으로 그대로 더 나아간 자리 (강의실 건물 안으로 들어간다)
    p = { x: p.x + p.tx * (s - TRACK_LENGTH), y: p.y + p.ty * (s - TRACK_LENGTH), tx: p.tx, ty: p.ty, bridge: p.bridge };
  }
  if (p.bridge !== bridgeLevel) return;
  // 차선 위치: 길 가운데에서 진행 방향의 옆으로 LANE_OFFSET만큼
  const centerX = p.x - p.ty * lane * LANE_OFFSET;
  const centerY = p.y + p.tx * lane * LANE_OFFSET;
  if (!isNearChair(centerX, centerY, CAR_HEIGHT)) return;
  // 자동차 그림은 앞이 위쪽이다. 트랙 방향으로 돌리고, 마주 오는 차는 180도 더 돌린다
  let angle = Math.atan2(p.tx, -p.ty);
  if (!forward) {
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

// ===== 미니맵 그리기 (화면 좌표) =====
// 트랙 전체가 MINIMAP_SIZE 네모 안에 들어가게 줄여서 그린다
function drawMinimap() {
  const width = WORLD_RIGHT - WORLD_LEFT;
  const height = WORLD_BOTTOM - WORLD_TOP;
  const scale = MINIMAP_SIZE / Math.max(width, height);
  // 맵 좌표 → 미니맵 좌표 (가운데 정렬)
  const offsetX = MINIMAP_X + (MINIMAP_SIZE - width * scale) / 2;
  const offsetY = MINIMAP_Y + (MINIMAP_SIZE - height * scale) / 2;
  const mapX = function (x) { return offsetX + (x - WORLD_LEFT) * scale; };
  const mapY = function (y) { return offsetY + (y - WORLD_TOP) * scale; };

  // 반투명 검은 바탕
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(MINIMAP_X - 6, MINIMAP_Y - 6, MINIMAP_SIZE + 12, MINIMAP_SIZE + 12);

  // 트랙: 땅 위는 흰색, 고가는 주황색 (4점마다 하나씩만 이어도 충분하다)
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  for (const bridgeLevel of [false, true]) {
    ctx.strokeStyle = bridgeLevel ? "#ff9f1c" : "#ffffff";
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i < trackSamples.length; i += 4) {
      const p = trackSamples[i];
      if (p.bridge === bridgeLevel) {
        if (drawing) ctx.lineTo(mapX(p.x), mapY(p.y));
        else ctx.moveTo(mapX(p.x), mapY(p.y));
        drawing = true;
      } else {
        drawing = false;
      }
    }
    ctx.stroke();
  }

  // 결승(강의실): 노란 점 / 의자: 빨간 점
  ctx.fillStyle = "#ffd84d";
  ctx.beginPath();
  ctx.arc(mapX(FINISH.x), mapY(FINISH.y), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff4d4d";
  ctx.beginPath();
  ctx.arc(mapX(chairX + CHAIR_SIZE / 2), mapY(chairY + CHAIR_SIZE / 2), 4, 0, Math.PI * 2);
  ctx.fill();
}

// ===== 맵 꾸미기: 나무·풀·학생·구름 배치 (시작할 때 한 번) =====
// 맵 아무 곳에나 놓아 보고, 길에 너무 가까우면 버린다
function placeScenery() {
  // 이 위치가 길(인도 바깥 끝)에서 margin보다 멀리 떨어져 있는가 (4점마다 하나씩만 재도 충분하다)
  function isAwayFromRoad(x, y, margin) {
    const limit = ROAD_HALF + SIDEWALK_WIDTH + margin;
    for (let i = 0; i < trackSamples.length; i += 4) {
      const dx = trackSamples[i].x - x;
      const dy = trackSamples[i].y - y;
      if (dx * dx + dy * dy < limit * limit) return false;
    }
    return true;
  }
  // min ~ max 사이의 아무 수
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  // 나무: 나무 중심이 길에서 나무 크기만큼 떨어진 곳에만
  for (let i = 0; i < TREE_COUNT; i++) {
    const x = randomBetween(WORLD_LEFT, WORLD_RIGHT - TREE_SIZE);
    const y = randomBetween(WORLD_TOP + 20, WORLD_BOTTOM - TREE_SIZE);
    if (isAwayFromRoad(x + TREE_SIZE / 2, y + TREE_SIZE / 2, TREE_SIZE * 0.6)) {
      trees.push({ x: x, y: y });
    }
  }

  // 풀 포기: 길에서 20픽셀 이상 떨어진 곳에만
  for (let i = 0; i < TUFT_COUNT; i++) {
    const x = randomBetween(WORLD_LEFT + 8, WORLD_RIGHT - 8);
    const y = randomBetween(WORLD_TOP + 30, WORLD_BOTTOM);
    if (isAwayFromRoad(x, y, 20)) {
      grassTufts.push({ x: x, y: y });
    }
  }

  // 학생: STUDENT_GAP마다 한 명씩, 왼쪽·오른쪽 인도를 번갈아. 출발 근처와 고가도로 위는 비워 둔다
  let side = -1;
  for (let s = 900; s < TRACK_LENGTH - 400; s += STUDENT_GAP) {
    if (pointAt(s).bridge || pointAt(s + STUDENT_WALK_RANGE).bridge) continue;
    const speed = 0.5 + Math.random() * 0.4;                 // 0.5 ~ 0.9
    students.push({
      s: s + Math.random() * STUDENT_WALK_RANGE,
      speed: Math.random() < 0.5 ? speed : -speed,           // 절반은 앞으로, 절반은 거꾸로
      minS: s,
      maxS: s + STUDENT_WALK_RANGE,
      side: side,
    });
    side = -side;   // 다음 학생은 반대쪽 인도
  }

  // 구름: 맵 곳곳에, 가로 위치·속도·크기는 제각각
  for (let i = 0; i < CLOUD_COUNT; i++) {
    clouds.push({
      x: randomBetween(WORLD_LEFT, WORLD_RIGHT),
      y: randomBetween(WORLD_TOP, WORLD_BOTTOM),
      speedX: randomBetween(0.2, 0.4),
      size: randomBetween(0.7, 1),
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
