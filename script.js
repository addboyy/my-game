// Chair Drift 3D — 2D 버전(my-game)의 게임 규칙을 그대로 쓰고, 화면만 Three.js로 3D로 그린다
// 게임 규칙(트랙, 조작, 드리프트, 충돌, 시간, 점수)은 my-game/script.js에서 그대로 가져온 코드다
// 3D 좌표: 2D 맵의 (x, y) → 3D의 (x, 높이, z = y)

// ===== 좌표와 크기 (여기 숫자만 바꾸면 그림이 바뀐다) =====
// 화면 크기: 가로 800, 세로 600. (0, 0)은 왼쪽 위, y가 커지면 아래로 간다.
// 맵은 화면보다 훨씬 넓다. 아래 좌표들은 전부 "맵 위의 좌표"다.

// ===== 카메라 (추격 시점) =====
// 화면은 맵의 일부만 비추는 카메라다. 카메라는 의자 뒤에 붙어서, 의자가 도는 대로 같이 돈다.
// 8장: 플레이테스트에서 어지럽다는 말이 두 번 나와서, 스턴 중에는 안 따라 돌고, 드리프트 중에는 덜 돌고, 한 프레임에 도는 각도에 상한을 뒀다
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const CAMERA_ANCHOR_Y = 430;                // 의자가 화면에서 머무르는 높이 (가로는 한가운데). 아래쪽이라 앞이 넓게 보인다
const CAMERA_TURN_FOLLOW = 0.06;            // 카메라가 목표 방향을 따라 도는 빠르기 (0~1). 작을수록 늦게, 부드럽게 따라 돈다
const CAMERA_MAX_TURN = 0.035;              // 한 프레임에 도는 최대 각도 (0.035 ≈ 2도). 의자가 휙 돌아도 화면은 이보다 빨리 안 돈다
const CAMERA_DRIFT_BLEND = 0.5;             // 드리프트 중 "실제로 움직이는 방향"을 섞는 비율 (0 = 의자 방향만, 1 = 움직이는 방향만)
const CAMERA_ZOOM = 0.7;                    // 화면 확대 배율 (1 = 원래 크기). 작을수록 카메라가 멀어져서 넓게 보인다
const VIEW_RADIUS = 650 / CAMERA_ZOOM;      // 화면이 돌아가도 보일 수 있는 의자 주변 범위 (이 밖은 그리지 않는다)
let cameraAngle = 0;                        // 카메라가 바라보는 방향 (0 = 맵 위쪽)

// ===== 트랙 목록 (난이도 3단계) =====
// 트랙마다: 이름, 난이도, 제한 시간, 자동차 수, 콘 수, 자동차 속도 곡선(처음 배율·10초마다 늘어나는 양·상한), 꼭짓점(points)
// 제한 시간은 "최고 속도로 직진만 했을 때 걸리는 시간"의 몇 배인지로 정했다 (쉬움 약 1.6배 · 보통 1.25배 · 어려움 1.18배)
// 꼭짓점은 출발부터 강의실(결승)까지 순서대로 직선으로 잇고, 꼭짓점마다 모서리를 반지름 CORNER_RADIUS인 원호로 둥글게 깎는다
// bridge: true인 점에서 다음 점까지의 직선은 고가도로다 (다른 길 위를 지나간다)
// 결승(마지막 점)이 맨 위에 있어야 한다 (그 위는 강의실 건물). 나란한 길끼리는 700 이상 떨어뜨린다
// training: true인 트랙(연습 서킷)은 예외: 처음 점과 마지막 점이 같은 자리(직선 한가운데)라 한 바퀴로 이어진다
const TRACKS = [
  {
    name: "캠퍼스 산책로",
    level: "쉬움",
    levelColor: "#7CFC00",
    timeLimit: 16,        // 직진 최단 9.8초
    carCount: 2,
    coneCount: 8,
    carSpeedStart: 0.8,
    carSpeedStep: 0.1,
    carSpeedMax: 1.0,
    points: [
      { x: 0, y: 400 },        // 출발
      { x: 0, y: -1600 },      // 직선 → 오른쪽
      { x: 900, y: -1600 },    // → 위로
      { x: 900, y: -3000 },    // → 왼쪽
      { x: 0, y: -3000 },      // → 위로
      { x: 0, y: -3800 },      // 강의실 앞 (결승)
    ],
  },
  {
    // 카트라이더 "빌리지 고가의 질주" 느낌: 긴 직선 + 직각 코너 + 헤어핀 + 고가도로
    name: "고가의 질주",
    level: "보통",
    levelColor: "#ffd84d",
    timeLimit: 42,        // 직진 최단 33.2초 (6주차 내 기록 36.87초)
    carCount: 5,
    coneCount: 25,
    carSpeedStart: 0.9,
    carSpeedStep: 0.1,
    carSpeedMax: 1.3,
    points: [
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
    ],
  },
  {
    // 뱀처럼 오르내리는 헤어핀 연속
    name: "지그재그 캠퍼스",
    level: "어려움",
    levelColor: "#ff4d4d",
    timeLimit: 33,        // 직진 최단 28.0초: 부스터를 써야 깰 수 있다
    carCount: 9,
    coneCount: 50,
    carSpeedStart: 1.0,
    carSpeedStep: 0.15,
    carSpeedMax: 1.6,
    points: [
      { x: 0, y: 400 },        // 출발
      { x: 0, y: -2400 },      // 위로 → 헤어핀
      { x: 800, y: -2400 },
      { x: 800, y: -600 },     // 아래로 → 헤어핀
      { x: 1600, y: -600 },
      { x: 1600, y: -2400 },   // 위로 → 헤어핀
      { x: 2400, y: -2400 },
      { x: 2400, y: -600 },    // 아래로 → 헤어핀
      { x: 3200, y: -600 },
      { x: 3200, y: -3200 },   // 긴 오르막 → 왼쪽
      { x: 1600, y: -3200 },
      { x: 1600, y: -4000 },   // 강의실 앞 (결승)
    ],
  },
  {
    // 연습 서킷 (8장): 장애물도 제한 시간도 없이 계속 돈다. 한 바퀴마다 랩 시간을 잰다
    // 직각 코너 좌우 섞기 + S자. 처음 점과 마지막 점이 같은 자리라 끝이 처음으로 이어진다
    name: "연습 서킷",
    level: "연습",
    levelColor: "#7ec8ff",
    training: true,
    timeLimit: 0,         // 제한 시간 없음
    carCount: 0,
    coneCount: 0,
    carSpeedStart: 1,
    carSpeedStep: 0,
    carSpeedMax: 1,
    points: [
      { x: 0, y: 0 },          // 출발 (위로)
      { x: 0, y: -2000 },      // → 오른쪽
      { x: 1600, y: -2000 },   // → 아래로
      { x: 1600, y: -800 },    // → 왼쪽
      { x: 900, y: -800 },     // → 아래로 (S자)
      { x: 900, y: 1100 },     // → 왼쪽
      { x: -900, y: 1100 },    // → 위로
      { x: -900, y: 300 },     // → 오른쪽
      { x: 0, y: 300 },        // → 위로
      { x: 0, y: 0 },          // 출발 자리로 돌아와서 한 바퀴
    ],
  },
];
// 지금 달리는 트랙: 주소 뒤의 ?track=번호로 고른다 (없으면 선택 화면부터, 기본은 "보통")
const TRACK_INDEX = readTrackIndex();
const TRACK = TRACKS[TRACK_INDEX];
const TRACK_POINTS = TRACK.points;
const STARTED_FROM_MENU = new URLSearchParams(location.search).has("track");   // 선택 화면에서 골라서 들어왔나
let menuIndex = TRACK_INDEX;   // 선택 화면에서 지금 고르고 있는 트랙
let isNewRecord = false;       // 이번 판이 그 트랙 최고 점수인가
const CORNER_RADIUS = 220;    // 코너 원호의 반지름. 클수록 코너가 완만하고, 작을수록 급해서 어렵다
                              // (ROAD_HALF + SIDEWALK_WIDTH = 190보다 커야 코너 안쪽 인도가 접히지 않는다)
const TRACK_STEP = 8;         // 트랙을 몇 픽셀마다 점으로 나눠 둘지 (작을수록 매끄럽지만 느리다)

// 길 단면: 왼쪽부터 잔디 → 인도 → 차도 → 인도 → 잔디 (전부 길 가운데 선에서 떨어진 거리)
const ROAD_HALF = 130;        // 차도 반폭 (차도 전체 폭 260 = 의자 5개 정도)
const SIDEWALK_WIDTH = 60;    // 양쪽 인도 폭 (학생 어깨 폭 52가 들어가게)
const LANE_OFFSET = 65;       // 자동차 차선 가운데가 길 가운데 선에서 떨어진 거리
const RAIL_WIDTH = 8;         // 인도 바깥 끝 가드레일 두께. 의자는 이 밖(잔디)으로 나갈 수 없다
const WALL_BOUNCE = 0.3;      // 가드레일에 부딪히면 바깥으로 가던 속도의 이 비율만큼 안쪽으로 튕긴다
const WALL_FRICTION = 0.92;   // 가드레일에 긁히는 동안 매 프레임 속도가 이 비율로 줄어든다
const TRACK_SEARCH = 150;     // 의자 위치를 찾을 때 직전 자리 앞뒤로 볼 트랙 점 수 (150점 = 1200픽셀)
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
const WORLD_TOP = TRACK.training ? Math.min(...TRACK_POINTS.map(p => p.y)) - 900 : FINISH.y;   // 강의실 건물 아래쪽 끝 (여기보다 위로는 못 간다). 연습 서킷은 강의실이 없다

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
let chairOnBridge = false;    // 고가도로 위인가 (고가 아래를 지날 때와 그리는 순서가 달라진다)

// 역주행 경고: 트랙 진행 방향과 반대로 움직이는 상태가 잠깐 이어지면 화면에 경고를 띄운다
const WRONG_WAY_SPEED = 1.5;  // 트랙 반대 방향으로 이 속도보다 빠르게 움직이면 역주행으로 본다
const WRONG_WAY_DELAY = 30;   // 역주행이 이 프레임 수(30 ≈ 0.5초)만큼 이어지면 경고 (살짝 흔들린 걸로는 안 뜨게)
let wrongWayFrames = 0;       // 역주행이 몇 프레임째 이어지고 있나

// ===== 조작 설정 (여기 숫자를 바꿔 가며 조작 느낌을 튜닝한다) =====
const CHAIR_SPEED = 9;        // 이동 속도: 한 프레임에 움직이는 픽셀 수 (최고 속도)
// 8장: 카트 게임 같은 손맛으로 바꿨다. 속도를 "앞으로 가는 속도"와 "옆으로 미끄러지는 속도"로 나눠서 따로 다룬다
const ACCEL = 0.035;          // 가속: 매 프레임 최고 속도까지 남은 차이의 이 비율만큼 빨라진다 (약 1.5초면 거의 최고 속도)
const COAST_DRAG = 0.985;     // ↑를 떼면 매 프레임 이 비율로 줄어든다 (바로 서지 않고 굴러간다)
const BRAKE = 0.35;           // 앞으로 가다 ↓를 누르면 매 프레임 이만큼 줄어든다 (브레이크)
const SIDE_GRIP = 0.3;        // 평소 옆 미끄러짐을 잡는 힘 (0~1): 클수록 바퀴가 길에 붙어서 바라보는 쪽으로만 간다
const TURN_RATE = 0.05;       // ← → 키로 한 프레임에 도는 각도 (라디안, 0.05 ≈ 3도)
const STEER_FULL_SPEED = 3;   // 이 속도 이상이면 핸들이 다 먹는다. 이보다 느리면 덜 돈다 (멈춰 있으면 안 돈다)
const HIGH_SPEED_STEER = 0.5;   // 최고 속도일 때 핸들이 먹는 비율 → 빠를 때 급한 코너는 드리프트나 감속이 필요하다
const REVERSE_SPEED_RATE = 0.5;  // ↓ 키로 뒤로 갈 때는 최고 속도의 이 비율만큼만

let chairVX = 0;              // 의자의 지금 가로 속도 (양수 = 오른쪽)
let chairVY = 0;              // 의자의 지금 세로 속도 (양수 = 아래)
let chairAngle = Math.atan2(chairStart.tx, -chairStart.ty);   // 의자가 바라보는 방향 (0 = 위쪽). 처음엔 트랙 진행 방향

// ===== 드리프트 (8장: 카트식) =====
// Shift + 방향키로 시작하면, 앞머리가 커브 안쪽으로 DRIFT_SLIP만큼 꺾인 채로 고정되고
// 의자가 "지나가는 길"이 부드러운 원을 그린다 (몸통이 빙글빙글 돌지 않는다)
// 같은 방향키: 원이 좁아진다(깊게) / 아무것도 안 누름: 보통 / 반대 방향키: 원이 넓어진다(얕게)
// Shift를 떼면 앞머리 쪽으로 빠져나가고, 0.5초 넘게 드리프트했으면 미니 부스트
const DRIFT_CURVE_IN = 0.05;     // 같은 방향키: 지나가는 길이 한 프레임에 꺾이는 각도 (최고 속도에서 반지름 약 180)
const DRIFT_CURVE = 0.034;       // 방향키 없음
const DRIFT_CURVE_OUT = 0.018;   // 반대 방향키 (카운터)
const DRIFT_SLIP = 0.6;          // 앞머리가 지나가는 방향보다 안쪽으로 꺾이는 각도 (0.6 ≈ 35도)
const DRIFT_SLIP_FOLLOW = 0.2;   // 앞머리가 그 각도까지 꺾이는 빠르기 (0~1)
const DRIFT_EXIT_KEEP = 0.5;     // Shift를 뗄 때 꺾인 각도를 이 비율만 남기고 앞머리를 펴 준다 (휙 꺾여 나가지 않게)
const DRIFT_SIDE_GRIP = 0.07;    // 스턴 중 옆 미끄러짐을 잡는 힘 (미끄러워서 튕긴 힘이 오래 간다)
const DRIFT_SPEED_KEEP = 0.997;  // 드리프트 중 매 프레임 남는 속도 비율 (거의 안 줄어든다)
const DRIFT_MIN_SPEED = 1.5;     // 이 속도보다 느리면 드리프트 연출(자국, 연기)을 하지 않는다
const DRIFT_START_SPEED = 4;     // 이 속도 이상일 때만 드리프트를 시작할 수 있다
const MINI_BOOST_MIN_FRAMES = 30;   // 이만큼(0.5초) 넘게 드리프트해야 미니 부스트
const MINI_BOOST_FRAMES = 25;       // 미니 부스트 길이 (약 0.4초)
const MINI_BOOST_RATE = 1.25;       // 미니 부스트 중 최고 속도 배율
let isDrifting = false;       // 지금 드리프트로 미끄러지는 중인가 (연출과 게이지에 쓴다)
let driftDir = 0;             // 드리프트 방향 (-1 = 왼쪽, 1 = 오른쪽, 0 = 드리프트 아님)
let driftFrames = 0;          // 이번 드리프트가 몇 프레임째인가
let driftSlip = 0;            // 지금 앞머리가 지나가는 방향보다 안쪽으로 꺾여 있는 각도
let miniBoostTimer = 0;       // 남은 미니 부스트 프레임

// 스키드 마크: 뒷바퀴가 지나간 자리에 남는 타이어 자국 (짧은 선분들의 목록)
// 선분마다 { x1, y1, x2, y2, life, bridge }. life가 줄어들수록 흐려지고 0이 되면 지운다
let skidMarks = [];
const SKID_LIFE = 240;        // 자국이 사라지기까지 걸리는 프레임 수 (240 ≈ 4초)
const SKID_WIDTH = 4;         // 자국 굵기
let lastWheels = null;        // 직전 프레임의 뒷바퀴 위치 (자국 선을 이어 그리는 데 쓴다)

// 바퀴 연기: 드리프트 중 뒷바퀴에서 피어오르는 회색 연기 ({ x, y, size, life })
let smokes = [];
const SMOKE_LIFE = 40;        // 연기가 사라지기까지 걸리는 프레임 수

// ===== 충돌 판정 (6장) =====
// 판정 영역(히트박스): 그림을 감싸는 사각형을 그림보다 조금 작게 잡는다 (스치기만 해도 부딪히면 억울하니까)
const CHAIR_HITBOX = 22;      // 의자 판정 사각형 한 변 (3D 의자 폭 약 21 = 65cm)
const CAR_HITBOX_SHRINK = 6;  // 자동차 판정은 그림(40×70)보다 가로·세로 6씩 작게
const STUDENT_HITBOX = 18;    // 학생 판정 사각형 한 변 (어깨 폭 약 16 = 45cm)
const CONE_HITBOX = 12;       // 콘 판정 사각형 한 변 (받침 13 = 40cm)

// ===== 디버그 표시 (2D 7장과 같다): 화면 왼쪽에 지금 상태(숫자)를 띄운다. D 키로 켜고 끈다 =====
let showDebug = false;        // true면 디버그 글씨를 띄운다
let showHitbox = showDebug;   // 2D와 맞춰 showDebug와 같이 켜지고 꺼진다 (3D에서는 판정 테두리를 아직 그리지 않는다)

// 부딪혔을 때 효과 (기획서: 학생 = 슬로우, 자동차 = 튕겨 나가고 잠시 스턴). 시간은 전부 프레임 수 (60 ≈ 1초)
const SLOW_FRAMES = 60;       // 학생·콘에 부딪히면 이만큼 느려진다
const SLOW_SPEED_RATE = 0.4;  // 슬로우 중 최고 속도 비율
const STUN_FRAMES = 45;       // 자동차에 부딪히면 이만큼 조작이 안 된다
const STUN_SPIN = 0.25;       // 스턴 중 의자가 한 프레임에 빙글 도는 각도
const CAR_BOUNCE = 14;        // 자동차에 부딪혀 튕겨 나가는 속도
const HIT_COOLDOWN = 60;      // 한 번 부딪힌 뒤 이만큼은 무적 (매 프레임 계속 부딪히지 않게)
let slowTimer = 0;            // 남은 슬로우 프레임 (0이면 정상)
let stunTimer = 0;            // 남은 스턴 프레임
let hitCooldown = 0;          // 남은 무적 프레임
let hitMessage = "";          // 의자 위에 띄울 글자 ("슬로우!", "쾅! 스턴")
let hitMessageTimer = 0;      // 글자를 띄울 남은 프레임
let flashTimer = 0;           // 화면이 빨갛게 번쩍이는 남은 프레임 (자동차 충돌)

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
const CAR_WIDTH = 58;         // 자동차 폭 (1.8m)
const CAR_HEIGHT = 144;       // 자동차 길이 (4.5m). 2D에서 위에서 본 그림의 세로라서 이름이 HEIGHT
// 자동차들: 배열 하나에 여러 대를 담는다. 한 대는 { s: 트랙 거리, speed: 속도, lane: 차선 }
// speed가 양수면 의자와 같은 방향(오른쪽 차선, lane 1), 음수면 마주 오는 차(반대편 차선, lane -1)
// CAR_COUNT 숫자만 바꾸면 코드를 고치지 않아도 자동차 수가 바뀐다
const CAR_COUNT = TRACK.carCount;   // 트랙마다 다르다 (트랙 목록에서)
let cars = [];
const CAR_RESPAWN_AHEAD = 2500;   // 자동차가 멀어지면 의자보다 이만큼 앞에 다시 나타난다
const CAR_RESPAWN_BEHIND = 1500;  // 의자보다 이만큼 뒤로 처지면 다시 나타나게 한다
const CAR_GAP = CAR_HEIGHT * 1.5; // 같은 차선 앞차와 이보다 가까워지지 않는다 (차 가운데끼리 거리. 겹치거나 뚫고 지나가지 않게)
const CAR_INSIDE_BUILDING = 150;  // 결승을 지나 이만큼 더 가면 강의실 건물 안에 완전히 가려진다

// 공사 콘: 차도 위에 가만히 놓인 장애물. 한 개는 { s: 트랙 거리, offset: 길 가운데에서 옆으로 떨어진 거리 }
// offset이 양수면 진행 방향 오른쪽, 음수면 왼쪽
const CONE_COUNT = TRACK.coneCount; // 트랙마다 다르다
const CONE_SIZE = 24;
let cones = [];

// 횡단보도와 길을 건너는 학생: 트랙 곳곳의 직선 구간에 횡단보도를 만들고, 학생이 차도를 가로질러 오간다
// 건너는 학생 한 명은 { s: 횡단보도 위치, offset: 길 가운데에서 옆으로 떨어진 거리, speed: 건너는 속도 }
const CROSSWALK_GAP = 3000;                              // 횡단보도 사이 간격 (트랙 거리)
const CROSSERS_PER_CROSSWALK = 2;                        // 횡단보도 하나에 건너는 학생 수
const CROSS_RANGE = ROAD_HALF + SIDEWALK_WIDTH / 2;      // 한쪽 인도 가운데 ~ 반대편 인도 가운데
let crosswalks = [];
let crossers = [];

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
const TIME_LIMIT = TRACK.timeLimit;   // 제한 시간(초). 트랙마다 다르다 (트랙 목록에서)
let startTime = 0;                // 출발한 순간의 시각 (Date.now() 값, 밀리초)
let remainingMs = TIME_LIMIT * 1000;   // 남은 시간 (밀리초)
let timeLeft = TIME_LIMIT;        // 화면에 보여 줄 남은 시간 (정수 초)

// ===== 게임 상태와 점수 (6장) =====
// "start" = 시작 화면 (8장) / "paused" = Esc 일시 정지 (8장) / "select" = 트랙 선택 화면 / "countdown" = 출발 전 3, 2, 1 / "playing" = 달리는 중
// "finished" = 강의실 도착 (성공) / "gameover" = 시간 초과 (결석)
// 처음 열면 시작 화면. 트랙을 골라 페이지를 다시 불러온 경우(?track=)에는 바로 카운트다운
let gameState = STARTED_FROM_MENU ? "countdown" : "start";
let score = 0;                    // 점수 = 도착했을 때 남은 시간 × 100 (시간 초과면 0)
let finishSeconds = 0;            // 도착까지 걸린 시간 (초)
const FINISH_MARGIN = 60;         // 결승 지점 이만큼 앞에 닿으면 도착으로 친다

// ===== 연습 서킷 랩 기록 (8장) =====
// 트랙을 따라 실제로 달린 거리를 더해 간다 (뒤로 가면 빠진다 → 거꾸로 돌아서 랩을 채울 수 없다)
// 의자는 출발선보다 150 뒤에서 출발하니까, 150을 달리면 출발선, 거기서 한 바퀴(TRACK_LENGTH)마다 1랩
const LAP_LINE_OFFSET = 150;
let lapDistance = 0;              // 출발해서 트랙을 따라 앞으로 달린 거리
let lapLastS = START_LINE_S - 150;   // 직전 프레임의 chairS (얼마나 갔는지 비교용)
let lapsDone = 0;                 // 다 돈 바퀴 수
let lapStartTime = 0;             // 지금 바퀴를 시작한 시각 (Date.now())
let lastLapSeconds = 0;           // 직전 바퀴 기록 (초, 0 = 아직 없음)

// ===== 일시 정지 메뉴 (8장, Esc 키) =====
const PAUSE_OPTIONS = ["계속 달리기", "처음부터 다시", "트랙 선택으로"];
let pauseIndex = 0;               // 메뉴에서 고르고 있는 줄
let pausedFrom = "";              // 멈추기 전 상태 ("countdown" 또는 "playing") → 계속하면 여기로
let pausedAt = 0;                 // 멈춘 시각 (계속할 때 멈춰 있던 시간만큼 시계를 민다)

// 부스터 게이지: 화면 아래 가운데
const GAUGE_X = 300;
const GAUGE_Y = 570;
const GAUGE_WIDTH = 200;
const GAUGE_HEIGHT = 14;
const GAUGE_FILL = 0.4;   // 0 = 비어 있음, 1 = 가득 참


// ===== 맵 꾸미기와 장애물 배치 (2D 버전과 같다) =====
placeScenery();
crosswalks = findCrosswalks();
createCars();
createCones();
createCrossers();

// ===== 키보드 입력 (2D 버전과 같다) =====
document.addEventListener("keydown", function (e) {
  // 방향키·스페이스바로 페이지가 스크롤되지 않게 막는다
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Control", "Enter"].includes(e.key)) {
    e.preventDefault();
  }
  // Esc: 달리는 중(카운트다운 포함)이면 일시 정지 메뉴, 메뉴에서는 계속하기, 트랙 선택 화면에서는 시작 화면으로
  if (e.key === "Escape") {
    if (gameState === "playing" || gameState === "countdown") pauseGame();
    else if (gameState === "paused") resumeGame();
    else if (gameState === "select") gameState = "start";
    return;
  }
  // 일시 정지 메뉴: ↑↓로 고르고 Enter. 메뉴 중에는 키가 게임에 들어가지 않게 여기서 끝낸다
  if (gameState === "paused") {
    if (e.key === "ArrowUp") pauseIndex = (pauseIndex + PAUSE_OPTIONS.length - 1) % PAUSE_OPTIONS.length;
    if (e.key === "ArrowDown") pauseIndex = (pauseIndex + 1) % PAUSE_OPTIONS.length;
    if (e.key === "Enter") choosePauseOption();
    return;
  }

  // ↑를 새로 누른 순간을 기록한다 (출발 부스터 판정용). 꾹 누르고 있을 때 반복해서 들어오는 건 무시
  if (e.key === "ArrowUp" && !keys["ArrowUp"]) {
    upPressTime = Date.now();
  }
  // R 키: 도착했거나 게임 오버일 때 다시 시작 (한글 입력 상태의 "ㄱ"도 받게 e.code도 본다)
  if ((e.key === "r" || e.key === "R" || e.code === "KeyR") && (gameState === "finished" || gameState === "gameover")) {
    resetGame();
  }

  // 키를 누른 순간에 소리 장치를 켠다 (브라우저 소리 제한 풀기)
  unlockAudio();

  // M 키: 음소거 켜고 끄기 (한글 입력 상태의 "ㅡ"도 받게 e.code도 본다)
  if (e.key === "m" || e.key === "M" || e.code === "KeyM") {
    isMuted = !isMuted;
    saveMuted(isMuted);
  }

  // 시작 화면: 아무 키나 누르면 트랙 선택으로 (이 키는 여기서 끝낸다. Enter가 트랙 선택까지 바로 넘어가지 않게)
  if (gameState === "start") {
    gameState = "select";
    return;
  }

  // D 키: 디버그 표시를 켜고 끈다 (한글 입력 상태의 "ㅇ"도 받게 e.code도 본다)
  if (e.key === "d" || e.key === "D" || e.code === "KeyD") {
    showDebug = !showDebug;
    showHitbox = showDebug;
  }

  // 트랙 선택 화면: ← → 로 고르고 Enter로 출발
  if (gameState === "select") {
    if (e.key === "ArrowLeft") menuIndex = (menuIndex + TRACKS.length - 1) % TRACKS.length;
    if (e.key === "ArrowRight") menuIndex = (menuIndex + 1) % TRACKS.length;
    if (e.key === "Enter") chooseTrack(menuIndex);
  }
  // T 키: 결과 화면에서 트랙 선택으로 (한글 입력 상태의 "ㅅ"도 받게 e.code도 본다)
  if ((e.key === "t" || e.key === "T" || e.code === "KeyT") && (gameState === "finished" || gameState === "gameover")) {
    menuIndex = TRACK_INDEX;
    gameState = "select";
  }
  keys[e.key] = true;
});
document.addEventListener("keyup", function (e) {
  keys[e.key] = false;
});
window.addEventListener("blur", function () {
  for (const key in keys) {
    keys[key] = false;
  }
});

// 다른 탭으로 가면 브라우저가 게임 루프(requestAnimationFrame)를 멈추는데 시계(Date.now)는 계속 간다 (2D 7장과 같은 수정)
// → 숨어 있던 시간만큼 시작 시각들을 뒤로 밀어서 시간도 멈춘 것처럼 만든다
let hiddenAt = 0;   // 탭이 숨겨진 시각 (0 = 숨겨져 있지 않음)
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    hiddenAt = Date.now();
  } else if (hiddenAt !== 0) {
    // 일시 정지 중이었으면 건너뛴다 (계속할 때 멈춰 있던 시간 전체를 한꺼번에 민다)
    if (gameState !== "paused") shiftClocks(Date.now() - hiddenAt);
    hiddenAt = 0;
  }
});

// ===== 3D 전용 설정 (여기 숫자를 바꾸면 3D 화면이 바뀐다) =====
// 크기 기준: 차선 폭(130) ≈ 4m → 1m ≈ 32칸. 의자·사람·차·콘을 현실 비율로 만든다
// 좌표 바꾸기: 2D 맵의 (x, y) → 3D의 (x, 높이, z=y). 1픽셀 = 3D 1칸
const BRIDGE_HEIGHT = 130;       // 고가도로 높이 (약 4m, 차가 아래로 지나갈 수 있게)
const RAMP_LENGTH = 600;         // 고가 양쪽 끝 오르막·내리막 길이
const CURB_HEIGHT = 3;           // 인도 턱 높이
const RAIL_HEIGHT = 20;          // 가드레일 높이
const DECK_THICKNESS = 20;       // 고가 바닥 두께
const CAM_DISTANCE = 170;        // 카메라가 의자 뒤로 떨어진 거리
const CAM_HEIGHT = 85;           // 카메라 높이
const CAM_UNDER_HEIGHT = 60;     // 고가 아래를 지날 때 카메라 높이 (고가 바닥에 부딪히지 않게)
const CAM_LOOK_AHEAD = 200;      // 카메라가 의자보다 이만큼 앞을 바라본다
const SKID_MAX = 2000;           // 한 번에 그릴 수 있는 스키드 마크 조각 수
const SMOKE_MAX = 80;            // 한 번에 그릴 수 있는 연기 수
const CHAIR_MODEL_SCALE = 1;     // 의자 3D 모델 크기 배율 (1 = 현실 비율). 바꾸면 CHAIR_HITBOX도 같이 맞춘다

// ===== 난이도 곡선 (8장): 출발하고 시간이 지날수록 자동차가 빨라진다 =====
// 프레임 수가 아니라 실제로 흐른 시간(Date.now() - startTime)으로 잰다 → 120Hz 기기에서도 똑같이 어려워진다
// 숫자는 트랙마다 다르다 (트랙 목록의 carSpeedStart · carSpeedStep · carSpeedMax)
const CAR_SPEED_START = TRACK.carSpeedStart;   // 처음 자동차 속도 배율 (쉬움 0.8 · 보통 0.9 · 어려움 1.0)
const CAR_SPEED_STEP = TRACK.carSpeedStep;     // 한 번 어려워질 때마다 늘어나는 배율
const CAR_SPEED_MAX = TRACK.carSpeedMax;       // 상한: 이보다 빨라지지 않는다 (쉬움 1.0 · 보통 1.3 · 어려움 1.6)
const LEVEL_UP_SECONDS = 10;      // 몇 초마다 어려워지나
let carSpeedRate = CAR_SPEED_START;    // 지금 자동차 속도 배율
let nextLevelUp = LEVEL_UP_SECONDS;    // 다음에 어려워질 시점 (출발 후 초). 한 번만 올리려고 다음 시점을 미뤄 둔다

// ===== 소리 (8장): 소리 파일 없이 Web Audio로 그 자리에서 만든다 (직접 제작) =====
// 브라우저는 키를 한 번이라도 누르기 전에는 소리를 못 내게 막는다 → 키를 누를 때 unlockAudio()로 소리를 켠다
const SOUND_VOLUME = 0.25;        // 전체 음량 (0~1). 교실에서 쓰니까 작게
let audioCtx = null;              // 소리를 만드는 장치 (처음 키를 누를 때 만든다)
let isMuted = loadMuted();        // M 키 음소거 (브라우저에 저장해서 새로고침해도 유지)
let lastCountBeep = 0;            // 카운트다운에서 마지막으로 삑 소리를 낸 숫자 (3, 2, 1)

// ===== 부스터 (기획서: 드리프트하면 게이지가 차고, 다 차면 Ctrl로 부스터) =====
const DRIFT_GAUGE_RATE = 0.006;  // 최고 속도로 드리프트할 때 한 프레임에 차는 게이지 (0.006 → 약 2.8초면 가득)
const BOOST_FRAMES = 90;         // 부스터가 이어지는 프레임 수 (90 = 1.5초)
const BOOST_SPEED_RATE = 1.6;    // 부스터 중 최고 속도 배율
const BOOST_GRIP = 0.12;         // 부스터 중 가속 (평소 ACCEL보다 훨씬 커서 확 튀어 나간다)
const BOOST_FOV = 75;            // 부스터 중 카메라 시야각 (넓어지면 빨라 보인다. 평소 60)
let boostGauge = 0;              // 부스터 게이지 (0 = 빈칸, 1 = 가득)
let boostTimer = 0;              // 남은 부스터 프레임

// ===== 번아웃 → 출발 대시 (↑와 ↓를 같이 누르면) =====
// 같이 누르는 동안 제자리에서 바퀴가 헛돌며 힘이 모이고, ↓만 떼면 모인 힘만큼 앞으로 튀어 나간다
const BURNOUT_CHARGE_FRAMES = 60;   // 힘이 가득 모이는 데 걸리는 프레임 수 (60 = 1초)
const BURNOUT_MIN_CHARGE = 0.3;     // 이만큼은 모여야 출발 대시가 나간다
const LAUNCH_BOOST_FRAMES = 45;     // 힘이 가득일 때 출발 대시가 이어지는 프레임 수
let burnoutCharge = 0;              // 모인 힘 (0 ~ 1)
let isBurnout = false;              // 지금 번아웃 중인가 (↑와 ↓를 같이 누르는 중)
let launchMessageTimer = 0;         // "출발!" 같은 글자를 띄울 남은 프레임
let launchText = "";                // 띄울 글자 ("출발!", "출발 부스터!", "너무 빨랐어요")
let boostWasPressed = false;        // 직전 프레임에 Ctrl이 눌려 있었나 (꾹 누르고 있어도 한 번만 쓰게)

// ===== 출발 카운트다운과 출발 부스터 (카트라이더처럼) =====
// 3 → 2 → 1 → GO! 동안은 움직일 수 없다. GO!가 뜨는 순간에 맞춰 ↑를 "새로" 누르면 출발 부스터
// 카운트다운 내내 ↑를 꾹 누르고 있으면 너무 빨리 누른 것이라 실패한다
const COUNTDOWN_MS = 3000;          // 카운트다운 길이 (3초)
const START_BOOST_EARLY_MS = 300;   // GO! 이만큼 전부터
const START_BOOST_LATE_MS = 250;    // GO! 이만큼 뒤까지 ↑를 새로 누르면 성공
const START_BOOST_FRAMES = 60;      // 출발 부스터가 이어지는 프레임 수 (1초)
let countdownStart = 0;             // 카운트다운을 시작한 시각 (Date.now())
let goTime = 0;                     // GO!가 뜬 시각
let upPressTime = 0;                // ↑를 마지막으로 새로 누른 시각 (0 = 아직 안 누름)
let startBoostChecked = false;      // 출발 부스터 판정을 끝냈나

// ===== 고가 높이: 고가 직선의 양 끝 RAMP_LENGTH 동안 부드럽게 오르내린다 =====
let bridgeStartS = Infinity;
let bridgeEndS = -Infinity;
for (const p of trackSamples) {
  if (p.bridge) {
    bridgeStartS = Math.min(bridgeStartS, p.s);
    bridgeEndS = Math.max(bridgeEndS, p.s);
  }
}
function heightAtS(s) {
  const p = pointAt(s);
  if (!p.bridge) return 0;
  const t = Math.max(0, Math.min(1, Math.min(s - bridgeStartS, bridgeEndS - s) / RAMP_LENGTH));
  return BRIDGE_HEIGHT * t * t * (3 - 2 * t);   // 0 → 1로 가되 처음과 끝은 천천히 (smoothstep)
}
for (const p of trackSamples) {
  p.h = heightAtS(p.s);   // 트랙 점마다 높이를 미리 계산해 둔다
}

// ===== Three.js 준비: 그리는 도구(renderer), 무대(scene), 카메라 =====
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3ff);
scene.fog = new THREE.Fog(0x9fd3ff, 1500, 3300);   // 멀리 있는 것은 하늘색으로 흐려진다

const camera = new THREE.PerspectiveCamera(60, SCREEN_WIDTH / SCREEN_HEIGHT, 5, 4000);
let camHeight = CAM_HEIGHT;

// 빛: 하늘에서 고르게 비추는 빛 + 해(그림자를 만드는 빛). 해는 의자를 따라다닌다
scene.add(new THREE.HemisphereLight(0xdff2ff, 0x4a7a3a, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -700;
sun.shadow.camera.right = 700;
sun.shadow.camera.top = 700;
sun.shadow.camera.bottom = -700;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 2500;
scene.add(sun);
scene.add(sun.target);

// ===== 재료(색) 만들기 도우미 =====
function mat(color) {
  return new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
}
const MAT = {
  road: mat(0x4d4d4d),
  sidewalk: mat(0xbfbfbf),
  white: mat(0xffffff),
  yellow: mat(0xf2c200),
  rail: mat(0x7a7a7a),
  concrete: mat(0x9a9a9a),
  pillar: mat(0x8c8c8c),
  black: mat(0x222222),
  trunk: mat(0x7a5230),
  leaves: mat(0x3fae5a),
};

// ===== 잔디 바닥: 캔버스에 잔디 무늬를 그려서 바닥에 붙인다 (이미지 파일 없이) =====
function makeGrassTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#3f9b3f";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = Math.random() < 0.5 ? "#368a36" : "#4aab48";
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
{
  const width = WORLD_RIGHT - WORLD_LEFT + 4000;
  const depth = WORLD_BOTTOM - WORLD_TOP + 4000;
  const texture = makeGrassTexture();
  texture.repeat.set(width / 128, depth / 128);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshLambertMaterial({ map: texture }));
  ground.rotation.x = -Math.PI / 2;   // 세워진 판을 눕혀서 바닥으로
  ground.position.set((WORLD_LEFT + WORLD_RIGHT) / 2, 0, (WORLD_TOP + WORLD_BOTTOM) / 2);
  ground.receiveShadow = true;
  scene.add(ground);
}

// ===== 트랙 띠 만들기 =====
// 트랙 점마다 길 가운데에서 옆으로 offA, offB 떨어진 두 점을 찍고, 이웃한 점끼리 삼각형 두 개로 이어 띠를 만든다
// liftA, liftB는 두 점의 높이 (같으면 바닥처럼 눕고, 다르면 벽처럼 선다)
// include(i)가 true인 점끼리만 잇는다 (예: 고가 구간만)
function buildRibbon(offA, offB, liftA, liftB, include, material, receiveShadow) {
  const positions = [];
  const indices = [];
  for (let i = 0; i < trackSamples.length; i++) {
    const p = trackSamples[i];
    const nx = -p.ty;   // 진행 방향의 오른쪽 옆 (2D의 x)
    const nz = p.tx;    // (2D의 y → 3D의 z)
    positions.push(p.x + nx * offA, p.h + liftA, p.y + nz * offA);
    positions.push(p.x + nx * offB, p.h + liftB, p.y + nz * offB);
    if (i > 0 && include(i - 1) && include(i)) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = receiveShadow !== false;
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}
const everywhere = function () { return true; };
const onBridge = function (i) { return trackSamples[i].bridge && trackSamples[i].h > 1; };
const SIDE = ROAD_HALF + SIDEWALK_WIDTH;          // 길 가운데 ~ 인도 바깥 끝
const OUTER = SIDE + RAIL_WIDTH;                  // 가드레일 바깥 끝

buildRibbon(-ROAD_HALF, ROAD_HALF, 1, 1, everywhere, MAT.road);                      // 차도
buildRibbon(-SIDE, -ROAD_HALF, CURB_HEIGHT, CURB_HEIGHT, everywhere, MAT.sidewalk);    // 왼쪽 인도
buildRibbon(ROAD_HALF, SIDE, CURB_HEIGHT, CURB_HEIGHT, everywhere, MAT.sidewalk);      // 오른쪽 인도
buildRibbon(-ROAD_HALF, -ROAD_HALF, 1, CURB_HEIGHT, everywhere, MAT.sidewalk);         // 인도 턱 (세운 띠)
buildRibbon(ROAD_HALF, ROAD_HALF, 1, CURB_HEIGHT, everywhere, MAT.sidewalk);
buildRibbon(-ROAD_HALF + 6, -ROAD_HALF + 10, 1.4, 1.4, everywhere, MAT.white);         // 흰 실선
buildRibbon(ROAD_HALF - 10, ROAD_HALF - 6, 1.4, 1.4, everywhere, MAT.white);
buildRibbon(-SIDE - RAIL_WIDTH / 2, -SIDE - RAIL_WIDTH / 2, CURB_HEIGHT, RAIL_HEIGHT, everywhere, MAT.rail);   // 가드레일
buildRibbon(SIDE + RAIL_WIDTH / 2, SIDE + RAIL_WIDTH / 2, CURB_HEIGHT, RAIL_HEIGHT, everywhere, MAT.rail);
buildRibbon(-OUTER, -OUTER, -DECK_THICKNESS, CURB_HEIGHT, onBridge, MAT.concrete);       // 고가 옆면
buildRibbon(OUTER, OUTER, -DECK_THICKNESS, CURB_HEIGHT, onBridge, MAT.concrete);
buildRibbon(-OUTER, OUTER, -DECK_THICKNESS, -DECK_THICKNESS, onBridge, MAT.concrete);   // 고가 밑면

// ===== 길 위의 작은 사각형들 (노란 점선, 횡단보도, 출발선) =====
// s0 ~ s1 구간에서, 길 가운데로부터 offA ~ offB 떨어진 사각형을 lift 높이에 깐다
function addRoadQuad(positions, s0, s1, offA, offB, lift) {
  const p0 = pointAt(s0);
  const p1 = pointAt(s1);
  const h0 = heightAtS(s0) + lift;
  const h1 = heightAtS(s1) + lift;
  const corners = [
    [p0.x - p0.ty * offA, h0, p0.y + p0.tx * offA],
    [p0.x - p0.ty * offB, h0, p0.y + p0.tx * offB],
    [p1.x - p1.ty * offA, h1, p1.y + p1.tx * offA],
    [p1.x - p1.ty * offB, h1, p1.y + p1.tx * offB],
  ];
  for (const k of [0, 1, 2, 1, 3, 2]) {
    positions.push(corners[k][0], corners[k][1], corners[k][2]);
  }
}
function addQuadMesh(positions, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
{
  // 가운데 노란 점선: 50마다 30 길이
  const dashes = [];
  for (let s = START_LINE_S + 40; s < TRACK_LENGTH - 200; s += 50) {
    addRoadQuad(dashes, s, s + 30, -2, 2, 1.5);
  }
  addQuadMesh(dashes, MAT.yellow);

  // 횡단보도 (결승 앞 + 학생이 건너는 곳): 흰 줄무늬
  const stripes = [];
  for (const cs of crosswalks.concat(TRACK.training ? [] : [TRACK_LENGTH - 120])) {   // 연습 서킷은 결승 횡단보도도 없다
    for (let x = -ROAD_HALF + 20; x < ROAD_HALF - 20; x += 40) {
      addRoadQuad(stripes, cs - 20, cs + 20, x, x + 20, 1.5);
    }
  }
  addQuadMesh(stripes, MAT.white);

  // 출발선: 흰색·검은색 체크무늬 두 줄
  const whites = [];
  const blacks = [];
  let col = 0;
  for (let x = -ROAD_HALF; x < ROAD_HALF; x += 20) {
    for (let row = 0; row < 2; row++) {
      const target = (col + row) % 2 === 0 ? whites : blacks;
      addRoadQuad(target, START_LINE_S - 20 + row * 20, START_LINE_S + row * 20, x, Math.min(x + 20, ROAD_HALF), 1.6);
    }
    col = col + 1;
  }
  addQuadMesh(whites, MAT.white);
  addQuadMesh(blacks, MAT.black);
}

// ===== 고가 기둥: 고가 아래에 일정한 간격으로. 아래를 지나는 길 위에는 세우지 않는다 =====
{
  const pillarGeometry = new THREE.BoxGeometry(16, 1, 16);
  for (let i = 0; i < trackSamples.length; i += 30) {
    const p = trackSamples[i];
    if (!p.bridge || p.h < 30) continue;
    for (const side of [-1, 1]) {
      const x = p.x - p.ty * side * (ROAD_HALF - 10);
      const z = p.y + p.tx * side * (ROAD_HALF - 10);
      let blocksRoad = false;
      for (let k = 0; k < trackSamples.length; k += 4) {
        const q = trackSamples[k];
        if (!q.bridge && Math.hypot(q.x - x, q.y - z) < SIDE + 30) blocksRoad = true;
      }
      if (blocksRoad) continue;
      const height = p.h - DECK_THICKNESS;
      const pillar = new THREE.Mesh(pillarGeometry, MAT.pillar);
      pillar.scale.y = height;
      pillar.position.set(x, height / 2, z);
      pillar.castShadow = true;
      scene.add(pillar);
    }
  }
}

// ===== 나무: 줄기(원기둥) + 잎(공) =====
// 나무가 수백 그루라서, 같은 모양을 한 번에 여러 개 그리는 InstancedMesh를 쓴다 (하나씩 그리면 느리다)
{
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(5, 8, 70, 8), MAT.trunk, trees.length);
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), MAT.leaves, trees.length);
  const placer = new THREE.Object3D();   // 위치·크기를 계산해 주는 도우미
  for (let i = 0; i < trees.length; i++) {
    const x = trees[i].x + TREE_SIZE / 2;
    const z = trees[i].y + TREE_SIZE / 2;
    placer.position.set(x, 35, z);
    placer.scale.set(1, 1, 1);
    placer.updateMatrix();
    trunks.setMatrixAt(i, placer.matrix);
    const r = 36 + Math.random() * 18;
    placer.position.set(x, 70 + r * 0.6, z);
    placer.scale.set(r, r * 0.9, r);
    placer.updateMatrix();
    crowns.setMatrixAt(i, placer.matrix);
  }
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks);
  scene.add(crowns);
}

// ===== 강의실 건물: 결승 너머에 길게 세운 벽돌 건물 + 노란 문 =====
function makeCanvasTexture(width, height, drawFn) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  drawFn(c.getContext("2d"));
  return new THREE.CanvasTexture(c);
}
if (!TRACK.training) {   // 연습 서킷에는 강의실이 없다
  const width = WORLD_RIGHT - WORLD_LEFT + 3000;
  const facade = makeCanvasTexture(256, 128, function (g) {
    g.fillStyle = "#9c4a3a";
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#a8dadc";
    for (let x = 20; x < 256; x += 64) {
      g.fillRect(x, 30, 36, 28);
      g.fillRect(x, 78, 36, 28);
    }
  });
  facade.wrapS = THREE.RepeatWrapping;
  facade.repeat.set(width / 256, 1);
  const wall = mat(0x9c4a3a);
  const front = new THREE.MeshLambertMaterial({ map: facade });
  // 상자 여섯 면의 재료: [오른쪽, 왼쪽, 위, 아래, 앞(+z, 트랙 쪽), 뒤]
  const building = new THREE.Mesh(new THREE.BoxGeometry(width, 220, 500), [wall, wall, wall, wall, front, wall]);
  building.position.set(FINISH.x, 110, WORLD_TOP - 250);
  building.receiveShadow = true;
  scene.add(building);

  const doorTexture = makeCanvasTexture(256, 128, function (g) {
    const gradient = g.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, "#e6b800");
    gradient.addColorStop(1, "#ffe066");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#333333";
    g.font = "bold 56px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("강의실", 128, 66);
  });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), new THREE.MeshBasicMaterial({ map: doorTexture }));
  door.position.set(FINISH.x, 36, WORLD_TOP + 1);
  scene.add(door);
}

// ===== 모델 만들기: 기본 도형을 조립한다 (모두 앞이 -z 쪽, 바닥이 높이 0) =====
function part(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// 바퀴 달린 사무용 의자 (폭 65cm, 등받이 위 1m): 방석 + 등받이(뒤쪽 = +z) + 팔걸이 + 가스 기둥 + 다리 5개 + 바퀴 5개
function makeChair() {
  const g = new THREE.Group();
  const purple = mat(0xc256b0);
  const darkPurple = mat(0x974189);
  const dark = mat(0x2b2b2b);
  g.add(part(new THREE.BoxGeometry(19, 4, 18), purple, 0, 15, 0));            // 방석 (높이 약 45cm)
  g.add(part(new THREE.BoxGeometry(19, 17, 3), darkPurple, 0, 26, 9));        // 등받이
  g.add(part(new THREE.BoxGeometry(1.5, 8, 2), dark, 0, 17, 8.5));            // 등받이 받침
  g.add(part(new THREE.BoxGeometry(2, 1.5, 10), dark, -10.5, 21, 1));         // 팔걸이
  g.add(part(new THREE.BoxGeometry(2, 1.5, 10), dark, 10.5, 21, 1));
  g.add(part(new THREE.BoxGeometry(1.5, 6, 1.5), dark, -10.5, 18, 1));        // 팔걸이 기둥
  g.add(part(new THREE.BoxGeometry(1.5, 6, 1.5), dark, 10.5, 18, 1));
  g.add(part(new THREE.CylinderGeometry(1.3, 1.3, 9, 8), dark, 0, 8.5, 0));   // 가스 기둥
  for (let k = 0; k < 5; k++) {
    const angle = (k / 5) * Math.PI * 2;
    const leg = part(new THREE.BoxGeometry(2, 1.5, 11), dark, Math.sin(angle) * 5.5, 3.5, -Math.cos(angle) * 5.5);
    leg.rotation.y = -angle;
    g.add(leg);
    g.add(part(new THREE.SphereGeometry(1.8, 8, 6), mat(0x111111), Math.sin(angle) * 11, 1.8, -Math.cos(angle) * 11));
  }
  return g;
}

// 자동차 (폭 1.8m, 길이 4.5m, 높이 1.5m): 주황 차체 + 어두운 유리 지붕 + 전조등(앞 = -z) + 바퀴 4개
function makeCar() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(58, 20, 144), mat(0xff8c1a), 0, 16, 0));        // 차체 (바닥이 땅에서 6 떠 있다)
  g.add(part(new THREE.BoxGeometry(50, 18, 72), mat(0x333a44), 0, 35, 8));         // 지붕과 유리
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3a0 });
  g.add(part(new THREE.BoxGeometry(12, 6, 2), lightMaterial, -19, 19, -72.5));     // 전조등
  g.add(part(new THREE.BoxGeometry(12, 6, 2), lightMaterial, 19, 19, -72.5));
  const tailMaterial = new THREE.MeshBasicMaterial({ color: 0xd62828 });
  g.add(part(new THREE.BoxGeometry(12, 5, 2), tailMaterial, -19, 20, 72.5));       // 미등
  g.add(part(new THREE.BoxGeometry(12, 5, 2), tailMaterial, 19, 20, 72.5));
  for (const [x, z] of [[-27, -46], [27, -46], [-27, 46], [27, 46]]) {
    const wheel = part(new THREE.CylinderGeometry(11, 11, 8, 14), mat(0x111111), x, 11, z);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel);
  }
  return g;
}

// 학생 (키 170cm, 어깨 45cm): 다리 두 개 + 초록 옷 몸통 + 팔 + 얼굴 + 머리카락
function makeStudent() {
  const g = new THREE.Group();
  const pants = mat(0x2b3a55);
  const shirt = mat(0x2e9e4f);
  const skin = mat(0xf2c9a0);
  g.add(part(new THREE.CylinderGeometry(2.6, 2.4, 26, 8), pants, -3.4, 13, 0));       // 다리
  g.add(part(new THREE.CylinderGeometry(2.6, 2.4, 26, 8), pants, 3.4, 13, 0));
  g.add(part(new THREE.CylinderGeometry(7.5, 6.5, 18, 10), shirt, 0, 35, 0));          // 몸통
  g.add(part(new THREE.CylinderGeometry(1.8, 1.6, 17, 8), shirt, -9, 35, 0));         // 팔
  g.add(part(new THREE.CylinderGeometry(1.8, 1.6, 17, 8), shirt, 9, 35, 0));
  g.add(part(new THREE.SphereGeometry(5.5, 10, 8), skin, 0, 49, 0));                   // 얼굴 (키 약 54)
  g.add(part(new THREE.SphereGeometry(5.8, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3b2a1e), 0, 50, 0.6));   // 머리카락
  return g;
}

// 공사 콘 (높이 70cm, 받침 40cm): 받침 + 주황 원뿔 + 흰 반사 띠
function makeCone() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(13, 1.5, 13), mat(0xb34700), 0, 0.75, 0));
  g.add(part(new THREE.ConeGeometry(5.5, 21, 16), mat(0xff7a00), 0, 12, 0));
  g.add(part(new THREE.CylinderGeometry(3.1, 3.6, 3, 16), mat(0xffffff), 0, 11, 0));
  return g;
}

// ===== 움직이는 것들의 3D 모델 (게임 계산은 2D 숫자 그대로, 화면만 3D) =====
const chairModel = makeChair();
chairModel.scale.setScalar(CHAIR_MODEL_SCALE);
// 부스터 불꽃: 의자 뒤(+z)로 뿜어져 나오는 주황·노랑 원뿔 두 겹
const boostFlame = new THREE.Group();
{
  const outer = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 12), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85 }));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(3.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
  outer.rotation.x = Math.PI / 2;   // 원뿔 끝이 뒤(+z)를 향하게 눕힌다
  inner.rotation.x = Math.PI / 2;
  outer.position.z = 13;
  inner.position.z = 8;
  boostFlame.add(outer);
  boostFlame.add(inner);
  boostFlame.position.set(0, 10, 12);
  boostFlame.visible = false;
  chairModel.add(boostFlame);
}

// ===== 트랙 거리 s 지점의 경사: 앞으로 1 갈 때 높이가 얼마나 바뀌나 =====
function slopeAtS(s) {
  return (heightAtS(s + 5) - heightAtS(s - 5)) / 10;
}
scene.add(chairModel);
const carModels = [];
for (let i = 0; i < CAR_COUNT; i++) {
  carModels.push(makeCar());
  scene.add(carModels[i]);
}
const studentModels = students.map(function () { const m = makeStudent(); scene.add(m); return m; });
const crosserModels = crossers.map(function () { const m = makeStudent(); scene.add(m); return m; });
let coneModels = [];
let coneModelsFor = null;   // 콘 모델이 어떤 cones 배열로 만들어졌는지 (콘이 사라지거나 새로 깔리면 다시 만든다)
let coneCount = -1;

let chairElevation = 0;     // 의자의 지금 높이 (고가 위면 올라간다)

// ===== 스키드 마크: 조각 SKID_MAX개를 담을 수 있는 하나의 모양을 매 프레임 고쳐 쓴다 =====
const skidPositions = new Float32Array(SKID_MAX * 4 * 3);
const skidGeometry = new THREE.BufferGeometry();
skidGeometry.setAttribute("position", new THREE.BufferAttribute(skidPositions, 3));
{
  const indices = [];
  for (let k = 0; k < SKID_MAX; k++) {
    const a = k * 4;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  skidGeometry.setIndex(indices);
}
const skidMesh = new THREE.Mesh(skidGeometry, new THREE.MeshBasicMaterial({
  color: 0x1a1a1a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
}));
skidMesh.frustumCulled = false;
scene.add(skidMesh);

// ===== 연기: 공 모양 SMOKE_MAX개를 미리 만들어 두고 필요한 만큼만 보인다 =====
const smokeModels = [];
for (let k = 0; k < SMOKE_MAX; k++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe6e6e6, transparent: true, depthWrite: false }));
  m.visible = false;
  scene.add(m);
  smokeModels.push(m);
}

// ===== 3D 화면 맞추기: 계산된 숫자대로 모델을 옮기고 카메라를 놓는다 =====
// 2D 각도(0 = 맵 위쪽, 시계 방향)는 3D에서 y축으로 -각도만큼 돌리면 같은 방향이 된다
function render3D() {
  const cx = chairX + CHAIR_SIZE / 2;
  const cy = chairY + CHAIR_SIZE / 2;

  // 의자 높이: 고가 위면 그 자리 고가 높이로, 아니면 땅(0). 계단처럼 튀지 않게 조금씩 따라간다
  const targetElevation = chairOnBridge ? trackSamples[chairTrackIndex].h : 0;
  chairElevation = chairElevation + (targetElevation - chairElevation) * 0.3;
  chairModel.position.set(cx, chairElevation, cy);
  // 오르막·내리막에서는 도로를 따라 앞뒤로 기운다
  // 경사 = 트랙 방향으로 1 갈 때 높이가 얼마나 바뀌나. 의자가 트랙과 비스듬히 서 있으면 그만큼 덜 기운다
  let chairPitch = 0;
  if (chairOnBridge) {
    const p = trackSamples[chairTrackIndex];
    const facing = Math.sin(chairAngle) * p.tx - Math.cos(chairAngle) * p.ty;   // 의자 방향과 트랙 방향이 같으면 1
    chairPitch = Math.atan(slopeAtS(chairS) * facing);
  }
  // 번아웃 중에는 부르르 떤다
  const shake = isBurnout ? (Math.random() - 0.5) * 0.12 : 0;
  chairModel.rotation.set(chairPitch, -chairAngle + shake, 0, "YXZ");
  // 부스터 불꽃: 부스터 중에만 보이고, 길이가 떨려서 타오르는 것처럼 보인다
  boostFlame.visible = boostTimer > 0 || miniBoostTimer > 0;
  boostFlame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
  // 무적 시간에는 깜빡인다
  chairModel.visible = !(hitCooldown > 0 && Math.floor(hitCooldown / 5) % 2 === 0);

  // 자동차
  for (let i = 0; i < cars.length; i++) {
    const pose = carPose(cars[i].s, cars[i].lane, cars[i].speed > 0);
    const h = cars[i].s <= TRACK_LENGTH ? heightAtS(cars[i].s) : 0;
    carModels[i].position.set(pose.x, h, pose.y);
    // 오르막·내리막에서는 도로를 따라 기운다 (마주 오는 차는 경사가 반대로 보인다)
    const pitch = cars[i].s <= TRACK_LENGTH ? Math.atan(slopeAtS(cars[i].s) * (cars[i].speed > 0 ? 1 : -1)) : 0;
    carModels[i].rotation.set(pitch, -pose.angle, 0, "YXZ");
  }

  // 인도 학생과 건너는 학생: 걷는 방향을 보고, 걸음마다 몸이 좌우로 흔들린다
  for (let i = 0; i < students.length; i++) {
    const st = students[i];
    const p = pointAt(st.s);
    const pos = trackPosition(st.s, st.side * (ROAD_HALF + SIDEWALK_WIDTH / 2));
    const dir = st.speed >= 0 ? 1 : -1;
    studentModels[i].position.set(pos.x, CURB_HEIGHT, pos.y);
    studentModels[i].rotation.set(0, -Math.atan2(p.tx * dir, -p.ty * dir), Math.sin(st.s * 0.3) * STUDENT_WOBBLE);
  }
  for (let i = 0; i < crossers.length; i++) {
    const cr = crossers[i];
    const p = pointAt(cr.s);
    const pos = trackPosition(cr.s, cr.offset);
    const dir = cr.speed >= 0 ? 1 : -1;
    const onSidewalk = Math.abs(cr.offset) > ROAD_HALF;
    crosserModels[i].position.set(pos.x, onSidewalk ? CURB_HEIGHT : 1, pos.y);
    crosserModels[i].rotation.set(0, -Math.atan2(-p.ty * dir, -p.tx * dir), Math.sin(cr.offset * 0.3) * STUDENT_WOBBLE);
  }

  // 콘: 부딪혀 사라졌거나 다시 시작해서 새로 깔렸으면 모델을 다시 만든다
  if (coneModelsFor !== cones || coneCount !== cones.length) {
    for (const m of coneModels) scene.remove(m);
    coneModels = cones.map(function (cone) {
      const m = makeCone();
      const pos = trackPosition(cone.s, cone.offset);
      m.position.set(pos.x, 1, pos.y);
      scene.add(m);
      return m;
    });
    coneModelsFor = cones;
    coneCount = cones.length;
  }

  // 스키드 마크: 자국 조각마다 두께 SKID_WIDTH인 얇은 사각형
  let count = 0;
  for (let k = Math.max(0, skidMarks.length - SKID_MAX); k < skidMarks.length; k++) {
    const m = skidMarks[k];
    const length = Math.hypot(m.x2 - m.x1, m.y2 - m.y1) || 1;
    const sx = -(m.y2 - m.y1) / length * SKID_WIDTH / 2;   // 자국 방향의 옆으로 두께 절반
    const sz = (m.x2 - m.x1) / length * SKID_WIDTH / 2;
    const y = (m.h || 0) + 1.8;
    const base = count * 12;
    skidPositions.set([
      m.x1 - sx, y, m.y1 - sz,  m.x1 + sx, y, m.y1 + sz,
      m.x2 - sx, y, m.y2 - sz,  m.x2 + sx, y, m.y2 + sz,
    ], base);
    count = count + 1;
  }
  skidGeometry.setDrawRange(0, count * 6);
  skidGeometry.attributes.position.needsUpdate = true;

  // 연기
  for (let k = 0; k < SMOKE_MAX; k++) {
    const m = smokeModels[k];
    const smoke = smokes[k];
    if (!smoke) {
      m.visible = false;
      continue;
    }
    m.visible = true;
    m.position.set(smoke.x, (smoke.h || 0) + 6 + (SMOKE_LIFE - smoke.life) * 0.3, smoke.y);
    m.scale.setScalar(smoke.size);
    m.material.opacity = 0.5 * smoke.life / SMOKE_LIFE;
  }

  // 카메라: 의자 뒤 CAM_DISTANCE, 위 camHeight에서 의자 앞쪽을 바라본다
  // 고가 아래를 지날 때는 카메라를 낮춰서 고가 바닥에 부딪히지 않게 한다
  const forwardX = Math.sin(cameraAngle);
  const forwardZ = -Math.cos(cameraAngle);
  const camX = cx - forwardX * CAM_DISTANCE;
  const camZ = cy - forwardZ * CAM_DISTANCE;
  const under = isChairUnderBridge() || isPointUnderBridge(camX, camZ);
  camHeight = camHeight + ((under ? CAM_UNDER_HEIGHT : CAM_HEIGHT) - camHeight) * 0.1;
  camera.position.set(camX, chairElevation + camHeight, camZ);
  // 부스터 중에는 시야가 넓어져서 더 빨라 보인다
  const targetFov = boostTimer > 0 ? BOOST_FOV : miniBoostTimer > 0 ? 67 : 60;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov = camera.fov + (targetFov - camera.fov) * 0.1;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(cx + forwardX * CAM_LOOK_AHEAD, chairElevation + 10, cy + forwardZ * CAM_LOOK_AHEAD);

  // 해와 그림자도 의자를 따라다닌다
  sun.position.set(cx + 400, chairElevation + 700, cy + 250);
  sun.target.position.set(cx, 0, cy);

  renderer.render(scene, camera);
}

// ===== 트랙 고르기 =====
// 주소 뒤의 ?track=번호를 읽는다. 없거나 이상하면 1번(보통)
function readTrackIndex() {
  const params = new URLSearchParams(location.search);
  if (!params.has("track")) return 1;   // 주소에 없으면 Number(null)이 0이 되니까 먼저 확인한다
  const n = Number(params.get("track"));
  if (Number.isInteger(n) && n >= 0 && n < TRACKS.length) return n;
  return 1;
}

// 선택한 트랙으로 출발한다. 지금 트랙이면 그대로 다시 시작하고,
// 다른 트랙이면 그 트랙 번호를 주소에 붙여 페이지를 다시 불러온다
// (길·나무·장애물은 시작할 때 한 번 만들기 때문에, 다시 불러오는 게 가장 깔끔하다)
function chooseTrack(index) {
  if (index === TRACK_INDEX) {
    resetGame();
  } else {
    location.search = "?track=" + index;
  }
}

// ===== 트랙별 최고 점수 (브라우저에 저장, 새로고침해도 남는다) =====
function loadBest(index) {
  try {
    return Number(localStorage.getItem("chairDrift.best." + index)) || 0;
  } catch (e) {
    return 0;   // 저장소를 못 쓰는 환경이면 기록 없이
  }
}
// 더 높은 점수면 저장하고 true를 돌려준다
function saveBest(index, value) {
  if (value <= loadBest(index)) return false;
  try {
    localStorage.setItem("chairDrift.best." + index, String(value));
  } catch (e) {
    // 저장소를 못 쓰면 저장만 건너뛴다
  }
  return true;
}

// ===== 트랙 미리보기: 꼭짓점을 이어 작은 지도로 그린다 (g = 2D 붓) =====
function drawTrackPreview(g, points, x, y, width, height, color) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const scale = Math.min(width / (maxX - minX || 1), height / (maxY - minY || 1)) * 0.85;
  const offsetX = x + (width - (maxX - minX) * scale) / 2;
  const offsetY = y + (height - (maxY - minY) * scale) / 2;
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.lineJoin = "round";
  g.beginPath();
  for (let i = 0; i < points.length; i++) {
    const px = offsetX + (points[i].x - minX) * scale;
    const py = offsetY + (points[i].y - minY) * scale;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  // 출발: 빨간 점, 결승(강의실): 노란 점
  const first = points[0];
  const last = points[points.length - 1];
  g.fillStyle = "#ff4d4d";
  g.beginPath();
  g.arc(offsetX + (first.x - minX) * scale, offsetY + (first.y - minY) * scale, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffd84d";
  g.beginPath();
  g.arc(offsetX + (last.x - minX) * scale, offsetY + (last.y - minY) * scale, 5, 0, Math.PI * 2);
  g.fill();
}

// ===== 카운트다운 시작: 3, 2, 1, GO! 가 끝나야 달릴 수 있다 =====
function startCountdown() {
  gameState = "countdown";
  isNewRecord = false;
  countdownStart = Date.now();
  upPressTime = 0;
  startBoostChecked = false;
  lastCountBeep = 0;
}

// ===== 카운트다운 중 매 프레임: 3초가 지나면 GO! (그때부터 제한 시간이 흐른다) =====
function updateCountdown() {
  // 숫자가 바뀔 때마다 한 번씩 삑 (3, 2, 1)
  const count = Math.ceil((COUNTDOWN_MS - (Date.now() - countdownStart)) / 1000);
  if (count > 0 && count !== lastCountBeep) {
    lastCountBeep = count;
    playSound("count");
  }
  if (Date.now() - countdownStart >= COUNTDOWN_MS) {
    gameState = "playing";
    goTime = Date.now();
    startTime = goTime;
    lapStartTime = goTime;   // 연습 서킷 첫 바퀴 시계
    playSound("go");
  }
}

// ===== 출발 부스터 판정 (GO! 직후 잠깐 동안, 달리는 중 매 프레임) =====
// ↑를 새로 누른 시각이 GO! 0.3초 전 ~ 0.25초 후 사이면 성공. 판정은 한 판에 한 번만
function checkStartBoost() {
  if (startBoostChecked) return;
  const inWindow = upPressTime >= goTime - START_BOOST_EARLY_MS && upPressTime <= goTime + START_BOOST_LATE_MS;
  if (upPressTime !== 0 && inWindow) {
    boostTimer = START_BOOST_FRAMES;
    playSound("boost");
    chairVX = Math.sin(chairAngle) * CHAIR_SPEED;   // 바로 튀어 나가게 속도를 준다
    chairVY = -Math.cos(chairAngle) * CHAIR_SPEED;
    launchText = "출발 부스터!";
    launchMessageTimer = 60;
    startBoostChecked = true;
  } else if (Date.now() > goTime + START_BOOST_LATE_MS) {
    // 기회가 지나갔다. GO! 전에 미리 눌러서 계속 누르고 있었다면 "너무 빨랐어요"
    if (upPressTime !== 0 && upPressTime < goTime - START_BOOST_EARLY_MS) {
      launchText = "너무 빨랐어요";
      launchMessageTimer = 60;
    }
    startBoostChecked = true;
  }
}

// ===== 이 지점이 지금 달리는 길과 이어지지 않은 고가 아래인가 (카메라 위치 검사용) =====
function isPointUnderBridge(x, z) {
  if (chairOnBridge) return false;
  for (let i = 0; i < trackSamples.length; i += 2) {
    const q = trackSamples[i];
    if (!q.bridge || q.h < 30) continue;
    if (Math.abs(i - chairTrackIndex) <= TRACK_SEARCH) continue;
    if (Math.hypot(q.x - x, q.y - z) < OUTER + 30) return true;
  }
  return false;
}

// ===== 화면 위 글자들 (HTML로 그린다): 시간, 점수, 미니맵, 경고, 결과 =====
const hud = {
  time: document.getElementById("time"),
  score: document.getElementById("score"),
  drift: document.getElementById("drift"),
  hit: document.getElementById("hit"),
  flash: document.getElementById("flash"),
  wrongWay: document.getElementById("wrong-way"),
  result: document.getElementById("result"),
  resultTitle: document.getElementById("result-title"),
  resultLines: document.getElementById("result-lines"),
  minimap: document.getElementById("minimap"),
  gauge: document.getElementById("gauge"),
  gaugeFill: document.querySelector("#gauge .fill"),
  gaugeLabel: document.querySelector("#gauge span"),
  burnout: document.getElementById("burnout"),
  burnoutFill: document.querySelector("#burnout .fill"),
  boostText: document.getElementById("boost-text"),
  countdown: document.getElementById("countdown"),
  countNum: document.getElementById("count-num"),
  countHint: document.getElementById("count-hint"),
  debug: document.getElementById("debug"),
  start: document.getElementById("start"),
  pause: document.getElementById("pause"),
  sound: document.getElementById("sound"),
};
// 일시 정지 메뉴 줄 만들기
const pauseRows = PAUSE_OPTIONS.map(function (text) {
  const row = document.createElement("div");
  row.className = "option";
  row.textContent = text;
  document.getElementById("pause-options").appendChild(row);
  return row;
});

// ===== 화면 크기 맞추기 (9장: 휴대폰처럼 화면이 800보다 좁으면 게임 화면 전체를 줄인다) =====
// 3D 그림과 글자의 좌표는 800×600 그대로 두고, 보이는 크기만 비율(zoom)로 줄인다 → 좌표 계산이 깨지지 않는다
const stage = document.getElementById("stage");
function fitStageToWindow() {
  const scale = Math.min(1, window.innerWidth / (SCREEN_WIDTH + 2), window.innerHeight / (SCREEN_HEIGHT + 2));   // +2는 테두리
  stage.style.zoom = scale;
}
fitStageToWindow();
window.addEventListener("resize", fitStageToWindow);   // 휴대폰을 가로·세로로 돌릴 때도 다시 맞춘다
hud.select = document.getElementById("select");
// 트랙 선택 카드: 트랙마다 이름, 난이도, 작은 지도, 제한 시간, 최고 점수
const selectCards = [];
for (let i = 0; i < TRACKS.length; i++) {
  const track = TRACKS[i];
  const card = document.createElement("div");
  card.className = "card";
  const best = loadBest(i);
  card.innerHTML = '<div class="name">' + track.name + '</div>' +
    '<div class="level" style="color:' + track.levelColor + '">' + track.level + '</div>' +
    '<canvas width="180" height="160"></canvas>' +
    (track.training
      ? '<div class="info">장애물 없음 · 계속 돌기</div>' +
        '<div class="best">' + (loadBestLap(i) > 0 ? "최고 랩 " + loadBestLap(i).toFixed(2) + "초" : "기록 없음") + '</div>'
      : '<div class="info">제한 시간 ' + track.timeLimit + '초 · 차 ' + track.carCount + '대</div>' +
        '<div class="best">' + (best > 0 ? "최고 점수 " + best : "기록 없음") + '</div>');
  drawTrackPreview(card.querySelector("canvas").getContext("2d"), track.points, 0, 0, 180, 160, "#ffffff");
  document.getElementById("cards").appendChild(card);
  selectCards.push(card);
}
const miniCtx = hud.minimap.getContext("2d");
const miniTrack = document.createElement("canvas");   // 트랙 모양은 한 번만 그려 두고 매번 복사한다
miniTrack.width = hud.minimap.width;
miniTrack.height = hud.minimap.height;
const MINI_SCALE = (miniTrack.width - 10) / Math.max(WORLD_RIGHT - WORLD_LEFT, WORLD_BOTTOM - WORLD_TOP);
function miniX(x) { return 5 + (x - WORLD_LEFT) * MINI_SCALE + (miniTrack.width - 10 - (WORLD_RIGHT - WORLD_LEFT) * MINI_SCALE) / 2; }
function miniY(y) { return 5 + (y - WORLD_TOP) * MINI_SCALE; }
{
  const g = miniTrack.getContext("2d");
  g.lineWidth = 3;
  g.lineJoin = "round";
  for (const level of [false, true]) {
    g.strokeStyle = level ? "#ff9f1c" : "#ffffff";
    g.beginPath();
    let drawing = false;
    for (let i = 0; i < trackSamples.length; i += 4) {
      const p = trackSamples[i];
      if (p.bridge === level) {
        if (drawing) g.lineTo(miniX(p.x), miniY(p.y));
        else g.moveTo(miniX(p.x), miniY(p.y));
        drawing = true;
      } else {
        drawing = false;
      }
    }
    g.stroke();
  }
}

function updateHud() {
  // 남은 시간: 10초 이하면 빨갛게, 1초 줄 때마다 크게 튀었다가 작아진다
  hud.time.textContent = "남은 시간 " + timeLeft + "초";
  if (TRACK.training) {
    // 연습 서킷: 몇 번째 바퀴인지와 지금 바퀴 시간
    // 달리는 중이면 지금까지, 일시 정지 중이면 멈춘 순간까지의 시간
    let lapSeconds = 0;
    if (gameState === "playing") lapSeconds = (Date.now() - lapStartTime) / 1000;
    if (gameState === "paused" && pausedFrom === "playing") lapSeconds = (pausedAt - lapStartTime) / 1000;
    hud.time.textContent = "랩 " + (lapsDone + 1) + " · " + lapSeconds.toFixed(1) + "초";
    hud.time.style.color = "#ffffff";
    hud.time.style.fontSize = "22px";
  } else if (timeLeft <= 10 && gameState === "playing") {
    const passed = 1 - (remainingMs % 1000) / 1000;
    hud.time.style.color = "#ff4d4d";
    hud.time.style.fontSize = (24 + 6 * (1 - passed)) + "px";
  } else {
    hud.time.style.color = timeLeft <= 10 ? "#ff4d4d" : "#ffffff";
    hud.time.style.fontSize = "24px";
  }
  if (TRACK.training) {
    // 연습 서킷: 지난 바퀴 기록과 최고 랩
    const bestLap = loadBestLap(TRACK_INDEX);
    hud.score.innerHTML = (lastLapSeconds > 0 ? "지난 랩: " + lastLapSeconds.toFixed(2) + "초" : "지난 랩: -") +
      "<small>" + (bestLap > 0 ? "최고 랩: " + bestLap.toFixed(2) + "초" : "최고 랩: 기록 없음") + "</small>";
  } else {
    // 점수 + 그 아래 작게 이 트랙 최고 점수 (8장: 플레이 중에도 목표가 보이게)
    const bestScore = loadBest(TRACK_INDEX);
    hud.score.innerHTML = "점수: " + (gameState === "playing" || gameState === "countdown" ? Math.floor(remainingMs / 10) : score) +
      "<small>" + (bestScore > 0 ? "최고 점수: " + bestScore : "최고 점수: 기록 없음") + "</small>";
  }

  // 카운트다운: 3, 2, 1 → GO! (GO!는 0.7초 동안)
  if (gameState === "countdown") {
    hud.countdown.style.display = "block";
    hud.countNum.textContent = String(Math.ceil((COUNTDOWN_MS - (Date.now() - countdownStart)) / 1000));
    hud.countNum.style.color = "#ffffff";
    hud.countHint.style.display = "block";
  } else if (gameState === "playing" && Date.now() - goTime < 700) {
    hud.countdown.style.display = "block";
    hud.countNum.textContent = "GO!";
    hud.countNum.style.color = "#7CFC00";
    hud.countHint.style.display = "none";
  } else {
    hud.countdown.style.display = "none";
  }

  hud.drift.style.display = isDrifting ? "block" : "none";
  hud.hit.style.display = hitMessageTimer > 0 ? "block" : "none";
  hud.hit.textContent = hitMessage;
  hud.hit.style.color = hitMessage === "슬로우!" ? "#7ec8ff" : "#ff5c5c";
  hud.flash.style.opacity = flashTimer > 0 ? 0.35 * flashTimer / 15 : 0;

  // 부스터 게이지: 찬 만큼 막대가 길어지고, 가득 차면 반짝이며 "Ctrl" 안내
  hud.gaugeFill.style.width = (boostGauge * 100) + "%";
  hud.gauge.classList.toggle("ready", boostGauge >= 1);
  hud.gaugeLabel.textContent = boostGauge >= 1 ? "부스터 준비! Ctrl" : "부스터 (드리프트하면 찬다)";

  // 번아웃: 모인 힘 막대
  hud.burnout.style.display = isBurnout ? "block" : "none";
  hud.burnoutFill.style.width = (burnoutCharge * 100) + "%";

  // 부스터 중 / 출발 대시 글자
  if (launchMessageTimer > 0) {
    hud.boostText.textContent = launchText;
    hud.boostText.style.color = launchText === "너무 빨랐어요" ? "#cccccc" : launchText === "자동차가 빨라졌다!" ? "#ff5c5c" : "#ff9f1c";
    hud.boostText.style.display = "block";
  } else if (boostTimer > 0) {
    hud.boostText.textContent = "BOOST!";
    hud.boostText.style.color = "#ff9f1c";
    hud.boostText.style.display = "block";
  } else {
    hud.boostText.style.display = "none";
  }
  hud.wrongWay.style.display = wrongWayFrames > WRONG_WAY_DELAY && Date.now() % 600 < 400 ? "block" : "none";

  // 미니맵: 트랙 + 강의실(노란 점) + 나(빨간 점)
  miniCtx.clearRect(0, 0, hud.minimap.width, hud.minimap.height);
  miniCtx.drawImage(miniTrack, 0, 0);
  miniCtx.fillStyle = "#ffd84d";
  miniCtx.beginPath();
  miniCtx.arc(miniX(FINISH.x), miniY(FINISH.y), 5, 0, Math.PI * 2);
  miniCtx.fill();
  miniCtx.fillStyle = "#ff4d4d";
  miniCtx.beginPath();
  miniCtx.arc(miniX(chairX + CHAIR_SIZE / 2), miniY(chairY + CHAIR_SIZE / 2), 4, 0, Math.PI * 2);
  miniCtx.fill();

  // 디버그 표시 (showDebug가 true일 때만)
  hud.debug.style.display = showDebug ? "block" : "none";
  if (showDebug) {
    hud.debug.textContent = [
      "[디버그]  D 키로 끄기",
      "gameState: " + gameState,
      "의자 x, y: " + Math.round(chairX) + ", " + Math.round(chairY),
      "속도: " + Math.hypot(chairVX, chairVY).toFixed(1) + " (최고 " + CHAIR_SPEED + ")",
      "트랙 위치: " + Math.round(chairS) + " / " + Math.round(TRACK_LENGTH) + (chairOnBridge ? "  (고가 위)" : ""),
      "자동차 " + cars.length + " · 콘 " + cones.length + " · 건너는 학생 " + crossers.length + " · 인도 학생 " + students.length,
      "점수(score): " + score + "  · 남은 시간: " + (remainingMs / 1000).toFixed(1) + "초",
      "슬로우 " + slowTimer + " · 스턴 " + stunTimer + " · 무적 " + hitCooldown,
      "부스터 게이지: " + boostGauge.toFixed(2) + " · 부스터 " + boostTimer,
      "자동차 속도 ×" + carSpeedRate.toFixed(2) + " · 다음 상승 " + nextLevelUp + "초",
    ].join("\n");
  }

  // 시작 화면 / 일시 정지 메뉴 / 소리 표시 (8장)
  hud.start.style.display = gameState === "start" ? "flex" : "none";
  hud.pause.style.display = gameState === "paused" ? "flex" : "none";
  for (let i = 0; i < pauseRows.length; i++) {
    pauseRows[i].classList.toggle("selected", i === pauseIndex);
  }
  hud.sound.textContent = isMuted ? "🔇 소리 꺼짐 (M)" : "🔊 M: 음소거";
  hud.sound.classList.toggle("muted", isMuted);

  // 결과 화면
  // 트랙 선택 화면
  hud.select.style.display = gameState === "select" ? "flex" : "none";
  if (gameState === "select") {
    for (let i = 0; i < selectCards.length; i++) {
      selectCards[i].classList.toggle("selected", i === menuIndex);
    }
  }

  if (gameState !== "finished" && gameState !== "gameover") {
    hud.result.style.display = "none";
  } else {
    hud.result.style.display = "flex";
    if (gameState === "finished") {
      hud.resultTitle.textContent = "강의실 도착!";
      hud.resultTitle.style.color = "#ffd84d";
      hud.resultLines.innerHTML = TRACK.name + " (" + TRACK.level + ")<br>점수: " + score + (isNewRecord ? "  신기록!" : "") +
        "<br>기록: " + finishSeconds.toFixed(2) + "초<br>최고 점수: " + loadBest(TRACK_INDEX);
    } else {
      hud.resultTitle.textContent = "GAME OVER";
      hud.resultTitle.style.color = "#ff4d4d";
      hud.resultLines.innerHTML = "지각! 결석 처리되었어요<br>최종 점수: " + score +
        "<br>강의실까지 " + Math.floor(chairS / TRACK_LENGTH * 100) + "% 왔어요<br>최고 점수: " + loadBest(TRACK_INDEX);
    }
  }
}

// ===== 게임 루프: 계산 → 3D 그리기 → 글자 → 다음 프레임 예약 =====
// 계산(updateGame)은 화면 속도와 상관없이 실제 시간으로 1초에 60번 한다
// 3D는 무거워서 화면이 30번밖에 못 그리면 계산을 두 번씩, 120Hz 모니터면 두 번에 한 번씩 한다
// 그래서 어느 컴퓨터에서든 의자 속도가 같다 (2D 버전은 화면 한 번 = 계산 한 번)
const STEP_MS = 1000 / 60;   // 계산 한 번이 맡는 시간
let lastFrameTime = performance.now();
let pendingMs = 0;           // 아직 계산하지 않고 밀린 시간
function gameLoop(now) {
  pendingMs = pendingMs + Math.min(now - lastFrameTime, 250);   // 탭을 오래 비웠다 돌아와도 한꺼번에 몰아서 계산하지 않게
  lastFrameTime = now;
  // 카운트다운 중에는 시간만 잰다 (아무것도 움직이지 않는다)
  if (gameState === "countdown") {
    updateCountdown();
  }
  while (pendingMs >= STEP_MS) {
    if (gameState === "playing") {
      checkStartBoost();
      updateGame();
    }
    updateCamera();   // 카메라 각도 (8장: 스턴 중엔 안 돌고, 드리프트 중엔 덜 돌고, 한 번에 최대 CAMERA_MAX_TURN)
    pendingMs = pendingMs - STEP_MS;
  }
  render3D();
  updateHud();
  requestAnimationFrame(gameLoop);
}

if (gameState === "countdown") startCountdown();   // 트랙을 골라 들어왔으면 3, 2, 1 카운트다운부터
cameraAngle = chairAngle;
requestAnimationFrame(gameLoop);


// =====================================================================
// ===== 여기부터는 2D 버전(my-game/script.js)에서 그대로 가져온 게임 규칙 =====
// =====================================================================

// ===== 계산: 한 프레임만큼 게임 상태(숫자)를 바꾼다 (gameState가 "playing"일 때만 불린다) =====
function updateGame() {
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

    // 번아웃: ↑와 ↓를 같이 누르면 제자리에서 바퀴가 헛돌며 힘을 모은다 (앞뒤로는 안 간다)
    const wasBurnout = isBurnout;
    isBurnout = keys["ArrowUp"] && keys["ArrowDown"] && stunTimer === 0;
    if (isBurnout) {
      throttle = 0;
      burnoutCharge = Math.min(1, burnoutCharge + 1 / BURNOUT_CHARGE_FRAMES);
    } else if (wasBurnout) {
      // 번아웃이 막 끝났다: ↓만 떼고 ↑는 그대로면 출발 대시, 아니면 모은 힘은 사라진다
      if (keys["ArrowUp"] && burnoutCharge >= BURNOUT_MIN_CHARGE) {
        boostTimer = Math.max(boostTimer, Math.round(LAUNCH_BOOST_FRAMES * burnoutCharge));
        chairVX = Math.sin(chairAngle) * CHAIR_SPEED * burnoutCharge;   // 바로 튀어 나가게 속도를 준다
        chairVY = -Math.cos(chairAngle) * CHAIR_SPEED * burnoutCharge;
        launchText = "출발!";
        launchMessageTimer = 40;
        playSound("boost");
      }
      burnoutCharge = 0;
    }

    // 부스터: 게이지가 가득일 때 Ctrl을 누르면 (꾹 누르고 있어도 한 번만)
    const boostPressed = keys["Control"] === true;
    if (boostPressed && !boostWasPressed && boostGauge >= 1 && stunTimer === 0) {
      boostTimer = BOOST_FRAMES;
      boostGauge = 0;
      playSound("boost");
    }
    boostWasPressed = boostPressed;
    // 부스터 중에는 ↑를 안 눌러도 앞으로 나간다
    if (boostTimer > 0 && stunTimer === 0 && !isBurnout) {
      throttle = 1;
    }

    // 스턴 중에는 키를 눌러도 소용없다. 의자는 빙글 돌면서 튕겨 나가던 방향으로 미끄러진다
    if (stunTimer > 0) {
      throttle = 0;
      steer = 0;
      chairAngle = chairAngle + STUN_SPIN;
    }

    // 2) 지금 속도를 "앞으로 가는 속도(forward)"와 "옆으로 미끄러지는 속도(side)"로 나눈다
    //    각도 0이 위쪽이라, 바라보는 방향은 (sin, -cos)이고 오른쪽 방향은 (cos, sin)이다
    let frontX = Math.sin(chairAngle);
    let frontY = -Math.cos(chairAngle);
    let forward = chairVX * frontX + chairVY * frontY;
    let side = chairVX * Math.cos(chairAngle) + chairVY * Math.sin(chairAngle);

    // 3) 드리프트 시작과 끝
    //    시작: Shift + 방향키, 앞으로 충분히 빠를 때. 끝: Shift를 떼거나, 느려지거나, 스턴
    if (driftDir === 0 && keys["Shift"] && steer !== 0 && forward > DRIFT_START_SPEED && stunTimer === 0) {
      driftDir = steer;
      driftFrames = 0;
      driftSlip = 0;
    } else if (driftDir !== 0 && (!keys["Shift"] || forward < DRIFT_MIN_SPEED || stunTimer > 0)) {
      // 오래 드리프트하고 Shift를 뗐으면 미니 부스트 (부딪혀서 끝난 건 제외)
      if (driftFrames >= MINI_BOOST_MIN_FRAMES && stunTimer === 0 && forward >= DRIFT_MIN_SPEED) {
        miniBoostTimer = MINI_BOOST_FRAMES;
        launchText = "미니 부스트!";
        launchMessageTimer = 30;
        playSound("boost");
      }
      // 앞머리를 지나가는 방향 쪽으로 반쯤 펴 준다 (꺾인 채로 놓으면 그쪽으로 휙 꺾여 나간다)
      if (stunTimer === 0) {
        const moveAngle = Math.atan2(chairVX, -chairVY);
        chairAngle = moveAngle + driftDir * driftSlip * DRIFT_EXIT_KEEP;
        frontX = Math.sin(chairAngle);
        frontY = -Math.cos(chairAngle);
        forward = chairVX * frontX + chairVY * frontY;
        side = chairVX * Math.cos(chairAngle) + chairVY * Math.sin(chairAngle);
      }
      driftDir = 0;
      driftSlip = 0;
    }

    // 4) 핸들: 속도가 붙어야 돈다 (멈춰 있으면 거의 안 돈다). 뒤로 갈 때는 자동차처럼 반대로 돈다
    //    STEER_FULL_SPEED에서 가장 잘 돌고, 그보다 빠를수록 조금씩 덜 돈다 (최고 속도에서 HIGH_SPEED_STEER배)
    const speedRatio = Math.min(1, Math.max(0, (Math.abs(forward) - STEER_FULL_SPEED) / (CHAIR_SPEED - STEER_FULL_SPEED)));
    const steerPower = Math.min(1, Math.abs(forward) / STEER_FULL_SPEED) * (1 - (1 - HIGH_SPEED_STEER) * speedRatio) * (forward < 0 ? -1 : 1);
    let sideGrip = SIDE_GRIP;
    if (driftDir === 0) {
      chairAngle = chairAngle + steer * TURN_RATE * steerPower;
    }
    if (stunTimer > 0) sideGrip = DRIFT_SIDE_GRIP;   // 스턴 중에는 미끄러워서 튕긴 힘이 오래 간다

    // 5) 최고 속도
    let maxSpeed = CHAIR_SPEED;
    if (driftDir !== 0) {
      // ----- 드리프트 중: 지나가는 길을 원으로 꺾고, 앞머리는 그보다 안쪽으로 꺾인 채로 -----
      let curve = DRIFT_CURVE;
      let slipTarget = DRIFT_SLIP;
      if (steer === driftDir) { curve = DRIFT_CURVE_IN; slipTarget = DRIFT_SLIP * 1.15; }
      if (steer === -driftDir) { curve = DRIFT_CURVE_OUT; slipTarget = DRIFT_SLIP * 0.7; }
      const moveAngle = Math.atan2(chairVX, -chairVY) + driftDir * curve;   // 지금 가는 방향에서 조금 더 꺾는다
      let driftSpeed = Math.hypot(chairVX, chairVY) * DRIFT_SPEED_KEEP;
      if (boostTimer > 0) driftSpeed = Math.max(driftSpeed, CHAIR_SPEED * BOOST_SPEED_RATE * 0.9);   // 부스터 중엔 빠르게
      driftSlip = driftSlip + (slipTarget - driftSlip) * DRIFT_SLIP_FOLLOW;
      chairAngle = moveAngle + driftDir * driftSlip;
      chairVX = Math.sin(moveAngle) * driftSpeed;
      chairVY = -Math.cos(moveAngle) * driftSpeed;
      chairX = chairX + chairVX;
      chairY = chairY + chairVY;
      driftFrames = driftFrames + 1;
    } else {
    // 학생·콘에 부딪혀 슬로우 중이면 더 느려진다
    if (slowTimer > 0) {
      maxSpeed = maxSpeed * SLOW_SPEED_RATE;
    }
    // 부스터 중이면 더 빨라지고 확 튀어 나간다
    let accel = ACCEL;
    if (boostTimer > 0) {
      maxSpeed = maxSpeed * BOOST_SPEED_RATE;
      accel = BOOST_GRIP;
    } else if (miniBoostTimer > 0) {
      maxSpeed = maxSpeed * MINI_BOOST_RATE;
      accel = BOOST_GRIP;
    }

    // 6) 앞으로 가는 속도: ↑ = 최고 속도까지 점점 가속 / ↓ = 브레이크, 서면 뒤로 / 안 누름 = 굴러가며 서서히 준다
    //    최고 속도보다 빠르면(부스터가 끝난 뒤, 슬로우) 천천히 최고 속도로 내려온다
    if (throttle > 0) {
      if (forward < maxSpeed) forward = forward + (maxSpeed - forward) * accel;
      else forward = forward + (maxSpeed - forward) * 0.05;
    } else if (throttle < 0) {
      if (forward > 0) forward = Math.max(0, forward - BRAKE);
      else forward = forward + (maxSpeed * throttle - forward) * ACCEL;
    } else {
      forward = forward * COAST_DRAG;
      if (forward > maxSpeed) forward = forward + (maxSpeed - forward) * 0.05;
    }

    // 7) 옆으로 미끄러지는 속도는 접지력만큼 줄인다 (평소엔 금방 0이 되고, 드리프트 중엔 오래 남는다)
    side = side * (1 - sideGrip);

    // 8) 두 속도를 다시 합쳐서, 속도만큼 위치를 옮긴다 (핸들로 각도가 바뀌었으니 새 방향으로 합친다)
    frontX = Math.sin(chairAngle);
    frontY = -Math.cos(chairAngle);
    chairVX = frontX * forward + Math.cos(chairAngle) * side;
    chairVY = frontY * forward + Math.sin(chairAngle) * side;
    chairX = chairX + chairVX;
    chairY = chairY + chairVY;
    }

    // 9) 지금 드리프트로 미끄러지는 중인가 (자국·연기·게이지)
    const speed = Math.hypot(chairVX, chairVY);               // 지금 속력 (가로·세로 속도로 만든 빗변 길이)
    isDrifting = driftDir !== 0 && speed > DRIFT_MIN_SPEED;

    // 드리프트로 미끄러지는 동안 부스터 게이지가 찬다 (빠를수록 빨리)
    if (isDrifting) {
      boostGauge = Math.min(1, boostGauge + DRIFT_GAUGE_RATE * Math.min(1, speed / CHAIR_SPEED));
    }
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

  // 충돌 검사: 의자 판정 사각형과 장애물 판정 사각형을 하나씩 비교한다
  // 같은 층(땅 위 / 고가 위)에 있는 것끼리만 부딪힌다. 고가 아래를 지나는 차와는 안 부딪힌다
  // 무적 시간(hitCooldown) 중에는 검사하지 않는다
  if (hitCooldown === 0) {
    const chairBox = getChairHitbox();
    const obstacleBoxes = getObstacleHitboxes();
    for (let i = 0; i < obstacleBoxes.length; i++) {
      const box = obstacleBoxes[i];
      if (box.bridge !== chairOnBridge) continue;
      if (checkCollision(chairBox, box)) {
        hitObstacle(box);
        break;   // 한 프레임에 하나만 처리한다 (부딪힌 뒤엔 무적이니까)
      }
    }
  }

  // 효과 타이머들을 1프레임씩 줄인다 (0 아래로는 안 내려간다)
  slowTimer = Math.max(0, slowTimer - 1);
  stunTimer = Math.max(0, stunTimer - 1);
  hitCooldown = Math.max(0, hitCooldown - 1);
  hitMessageTimer = Math.max(0, hitMessageTimer - 1);
  flashTimer = Math.max(0, flashTimer - 1);
  boostTimer = Math.max(0, boostTimer - 1);
  miniBoostTimer = Math.max(0, miniBoostTimer - 1);
  launchMessageTimer = Math.max(0, launchMessageTimer - 1);

  // 번아웃 중에는 뒷바퀴에서 연기가 난다 (세 프레임에 한 번꼴, 힘이 모일수록 조금 더 크게)
  if (isBurnout && Math.random() < 0.35) {
    const wheel = getRearWheels()[Math.floor(Math.random() * 2)];
    smokes.push({ x: wheel.x, y: wheel.y, size: 2 + burnoutCharge * 2, life: SMOKE_LIFE, h: chairElevation });
  }

  // 역주행 검사: 의자 속도를 트랙 진행 방향으로 나눠 본다 (내적: 양수 = 앞으로, 음수 = 거꾸로)
  const track = trackSamples[chairTrackIndex];
  const forwardSpeed = chairVX * track.tx + chairVY * track.ty;
  if (forwardSpeed < -WRONG_WAY_SPEED) {
    wrongWayFrames = wrongWayFrames + 1;
  } else {
    wrongWayFrames = 0;
  }

  // 드리프트 연출: 뒷바퀴 자리에 스키드 마크와 연기를 남긴다
  if (isDrifting) {
    const wheels = getRearWheels();
    if (lastWheels !== null) {
      // 직전 바퀴 위치 → 지금 바퀴 위치를 잇는 짧은 선을 바퀴마다 하나씩 남긴다 (고가 위 자국인지도 기억)
      for (let i = 0; i < 2; i++) {
        skidMarks.push({ x1: lastWheels[i].x, y1: lastWheels[i].y, x2: wheels[i].x, y2: wheels[i].y, life: SKID_LIFE, bridge: chairOnBridge, h: chairElevation });
      }
    }
    lastWheels = wheels;

    // 두 프레임에 한 번꼴로 바퀴 한쪽에서 연기를 피운다
    if (Math.random() < 0.5) {
      const wheel = wheels[Math.floor(Math.random() * 2)];
      smokes.push({ x: wheel.x, y: wheel.y, size: 6, life: SMOKE_LIFE, h: chairElevation });
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


  // 자동차들을 for 반복문으로 한 대씩 트랙을 따라 옮긴다 (몇 대든 이 코드 그대로)
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    let move = car.speed * carSpeedRate;   // 난이도 배율만큼 빠르게
    // 같은 차선 바로 앞차를 찾는다 (같은 방향 차는 s가 큰 쪽이 앞, 마주 오는 차는 s가 작은 쪽이 앞)
    const dir = car.speed > 0 ? 1 : -1;
    let gapAhead = Infinity;
    for (let j = 0; j < cars.length; j++) {
      if (j === i || cars[j].lane !== car.lane) continue;
      const gap = (cars[j].s - car.s) * dir;
      if (gap > 0 || (gap === 0 && j > i)) gapAhead = Math.min(gapAhead, gap);   // 딱 겹친 두 대는 번호로 앞뒤를 정한다
    }
    // 앞차가 느려서 가까워지면 CAR_GAP만 남기고 멈춘다 → 앞차 뒤에서 따라간다
    if (gapAhead - Math.abs(move) < CAR_GAP) {
      move = dir * Math.max(0, gapAhead - CAR_GAP);
    }
    car.s = car.s + move;
    // 다시 나타날 앞쪽 자리: 차들이 한곳에 몰리지 않게 조금씩 다르게
    const ahead = chairS + CAR_RESPAWN_AHEAD + Math.random() * 1500;

    if (car.speed > 0) {
      // 같은 방향 차: 결승을 지나면 강의실 건물 안으로 들어가 가려진다
      // 의자보다 한참 뒤로 처지거나 건물 안으로 다 들어가면, 의자보다 앞쪽에 다시 나타난다
      // 단, 의자가 결승 근처라 앞쪽 자리가 트랙 밖이면, 의자 뒤쪽(화면 밖)에 다시 놓는다
      if (car.s < chairS - CAR_RESPAWN_BEHIND || car.s > TRACK_LENGTH + CAR_INSIDE_BUILDING) {
        if (ahead < TRACK_LENGTH) {
          car.s = freeCarSpot(ahead, car);
        } else {
          car.s = freeCarSpot(chairS - CAR_RESPAWN_BEHIND + 200, car);
        }
      }
    } else {
      // 마주 오는 차: 의자 뒤로 지나가 버리면, 다시 의자 앞쪽에서 마주 오게 한다
      // 앞쪽 자리가 트랙 끝을 넘으면 강의실 건물 안에서 출발해서, 건물에서 나오는 것처럼 보이게 한다
      if (car.s < chairS - CAR_RESPAWN_BEHIND || car.s < 0) {
        car.s = freeCarSpot(Math.min(ahead, TRACK_LENGTH + CAR_INSIDE_BUILDING), car);
      }
    }
  }

  // 흔들림 시계를 조금 앞으로 돌린다 (풀잎 흔들림에 쓴다)
  swayTime = swayTime + SWAY_SPEED;

  // 학생들을 인도 위에서 걷는 속도만큼 옮기고, 자기 구간 끝에 닿으면 방향을 뒤집는다
  for (const student of students) {
    student.s = student.s + student.speed;
    if (student.s > student.maxS || student.s < student.minS) {
      student.speed = -student.speed;
    }
  }

  // 건너는 학생들: 차도를 가로질러 걷다가 반대편 인도 가운데에 닿으면 돌아선다
  for (let i = 0; i < crossers.length; i++) {
    const crosser = crossers[i];
    crosser.offset = crosser.offset + crosser.speed;
    if (crosser.offset > CROSS_RANGE || crosser.offset < -CROSS_RANGE) {
      crosser.speed = -crosser.speed;
    }
  }

  // 구름 그림자를 오른쪽으로 천천히 옮기고, 맵 오른쪽 끝 밖으로 나가면 왼쪽 끝 밖에서 다시 들어온다
  for (const cloud of clouds) {
    cloud.x = cloud.x + cloud.speedX;
    if (cloud.x - CLOUD_RADIUS * cloud.size > WORLD_RIGHT) {
      cloud.x = WORLD_LEFT - CLOUD_RADIUS * cloud.size;
    }
  }

  // 연습 서킷: 제한 시간도 결승도 없다. 랩만 잰다
  if (TRACK.training) {
    updateLaps();
    return;
  }

  // 남은 시간: 출발한 뒤 실제로 흐른 시간(Date.now())으로 잰다
  // 프레임 수를 세지 않으므로, 화면이 빠른 기기(120Hz)에서도 1초는 똑같이 1초다
  remainingMs = Math.max(0, TIME_LIMIT * 1000 - (Date.now() - startTime));
  timeLeft = Math.ceil(remainingMs / 1000);   // 화면에 보여 줄 정수 초 (60 → … → 1 → 0)

  // 난이도: 출발 후 LEVEL_UP_SECONDS초마다 자동차가 빨라진다 (상한 CAR_SPEED_MAX에서 멈춘다)
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  if (elapsedSeconds > nextLevelUp && remainingMs > 0) {   // 시간이 다 된 순간에는 올리지 않는다 (결과 화면에 글자가 뜨지 않게)
    nextLevelUp = nextLevelUp + LEVEL_UP_SECONDS;   // 다음 시점을 미뤄 둔다 (안 그러면 매 프레임 올라간다)
    if (carSpeedRate < CAR_SPEED_MAX) {
      carSpeedRate = Math.min(carSpeedRate + CAR_SPEED_STEP, CAR_SPEED_MAX);
      launchText = "자동차가 빨라졌다!";
      launchMessageTimer = 50;
    }
  }

  // 도착: 길 위에서 결승(강의실 문 앞)에 닿으면 성공. 점수 = 남은 시간 × 100
  if (chairS >= TRACK_LENGTH - FINISH_MARGIN) {
    gameState = "finished";
    score = Math.floor(remainingMs / 10);                       // 남은 ms ÷ 10 = 남은 초 × 100
    finishSeconds = (TIME_LIMIT * 1000 - remainingMs) / 1000;   // 걸린 시간 (초)
    isNewRecord = saveBest(TRACK_INDEX, score);                 // 이 트랙 최고 점수면 저장
    playSound(isNewRecord ? "record" : "finish");
  } else if (remainingMs === 0) {
    // 시간 초과: 지각 → 결석 (기획서의 "리타이어")
    gameState = "gameover";
    score = 0;
    playSound("gameover");
  }
}

// ===== 처음 상태로 되돌리기 (R 키로 다시 시작할 때) =====
// 한 판 동안 바뀌는 값은 전부 여기서 처음 값으로 되돌린다. 빠뜨리면 이전 판의 값이 남는다
// 게임 루프(gameLoop)는 다시 부르지 않는다. 이미 돌고 있어서, 또 부르면 루프가 두 개가 되어 두 배로 빨라진다
function resetGame() {
  // 의자: 출발선 뒤, 멈춘 상태, 트랙 방향을 보고
  chairX = chairStart.x - CHAIR_SIZE / 2;
  chairY = chairStart.y - CHAIR_SIZE / 2;
  chairVX = 0;
  chairVY = 0;
  chairAngle = Math.atan2(chairStart.tx, -chairStart.ty);
  chairTrackIndex = 0;
  chairS = 0;
  chairOnBridge = false;
  cameraAngle = chairAngle;         // 카메라도 의자 뒤에서 같은 방향을 보고

  // 장애물: 자동차·콘(부딪혀 사라진 것까지)·건너는 학생을 새로 배치
  createCars();
  createCones();
  createCrossers();

  // 효과와 연출
  slowTimer = 0;
  stunTimer = 0;
  hitCooldown = 0;
  hitMessageTimer = 0;
  flashTimer = 0;
  isDrifting = false;
  driftDir = 0;
  driftFrames = 0;
  driftSlip = 0;
  miniBoostTimer = 0;
  skidMarks = [];
  smokes = [];
  lastWheels = null;
  wrongWayFrames = 0;
  boostGauge = 0;
  boostTimer = 0;
  burnoutCharge = 0;
  isBurnout = false;
  launchMessageTimer = 0;

  // 시간과 점수
  startTime = Date.now();
  remainingMs = TIME_LIMIT * 1000;
  timeLeft = TIME_LIMIT;
  score = 0;
  finishSeconds = 0;
  carSpeedRate = CAR_SPEED_START;   // 난이도도 처음으로
  lapDistance = 0;                  // 연습 서킷 랩도 처음으로
  lapLastS = START_LINE_S - 150;
  lapsDone = 0;
  lastLapSeconds = 0;
  nextLevelUp = LEVEL_UP_SECONDS;
  startCountdown();   // 바로 달리지 않고 3, 2, 1 카운트다운부터
}

// ===== 트랙 만들기: TRACK_POINTS를 TRACK_STEP 간격의 점들로 나눈다 (시작할 때 한 번) =====
// 꼭짓점과 꼭짓점 사이는 직선, 꼭짓점 근처는 반지름 CORNER_RADIUS인 원호로 잇는다
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

  // i번째 점에서 i+1번째 점으로 가는 방향 (길이 1)
  function direction(i) {
    const a = TRACK_POINTS[i];
    const b = TRACK_POINTS[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  }

  // 꼭짓점 i에서 꺾이는 각도 (0 = 직진, π/2 = 직각). 처음과 마지막 점은 꺾이지 않는다
  function turnAngle(i) {
    if (i <= 0 || i >= TRACK_POINTS.length - 1) return 0;
    const inDir = direction(i - 1);
    const outDir = direction(i);
    const dot = inDir.x * outDir.x + inDir.y * outDir.y;
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  // 꼭짓점 i의 원호가 시작되는 곳이 꼭짓점에서 얼마나 떨어져 있나 (직각이면 반지름과 같다)
  function cornerCut(i) {
    return CORNER_RADIUS * Math.tan(turnAngle(i) / 2);
  }

  const n = TRACK_POINTS.length;
  for (let i = 0; i < n - 1; i++) {
    const a = TRACK_POINTS[i];
    const b = TRACK_POINTS[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const dir = direction(i);

    // 직선 부분: 양쪽 끝에서 원호가 차지할 만큼은 남겨 둔다
    // 끝점은 넣지 않는다 (바로 이어지는 원호의 첫 점과 같은 자리라 겹치면 거리 0인 구간이 생긴다)
    for (let d = cornerCut(i); d < length - cornerCut(i + 1); d += TRACK_STEP) {
      addSample(a.x + dir.x * d, a.y + dir.y * d, a.bridge === true);
    }

    // 꼭짓점 b의 원호
    if (i < n - 2) {
      const outDir = direction(i + 1);
      const turn = turnAngle(i + 1);
      // 오른쪽으로 꺾는가 왼쪽으로 꺾는가 (두 방향의 외적: 양수 = 오른쪽)
      const sign = dir.x * outDir.y - dir.y * outDir.x > 0 ? 1 : -1;
      // 원호 시작점: 꼭짓점에서 들어오던 방향으로 cornerCut만큼 앞
      const startX = b.x - dir.x * cornerCut(i + 1);
      const startY = b.y - dir.y * cornerCut(i + 1);
      // 원의 중심: 시작점에서 꺾는 쪽 옆으로 반지름만큼 (진행 방향의 오른쪽 옆 = (-dir.y, dir.x))
      const centerX = startX - dir.y * sign * CORNER_RADIUS;
      const centerY = startY + dir.x * sign * CORNER_RADIUS;
      const startAngle = Math.atan2(startY - centerY, startX - centerX);
      const steps = Math.ceil((CORNER_RADIUS * turn) / TRACK_STEP);   // 원호 길이 / 점 간격
      for (let k = 0; k < steps; k++) {
        const angle = startAngle + sign * turn * (k / steps);
        addSample(centerX + Math.cos(angle) * CORNER_RADIUS, centerY + Math.sin(angle) * CORNER_RADIUS, false);
      }
    }
  }

  // 마지막 꼭짓점(결승)은 위 반복에서 빠지므로 따로 넣는다
  const last = TRACK_POINTS[n - 1];
  addSample(last.x, last.y, false);

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
  // 연습 서킷은 한 바퀴로 이어져 있어서, 끝을 넘은 거리는 처음부터 다시 센다
  if (TRACK.training) s = ((s % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
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
  // 두 점 사이를 비율대로 섞는다. 진행 방향도 섞어야 코너에서 인도 위의 학생이 튀지 않는다
  const a = trackSamples[low];
  const b = trackSamples[high];
  const t = (s - a.s) / (b.s - a.s);
  const tx = a.tx + (b.tx - a.tx) * t;
  const ty = a.ty + (b.ty - a.ty) * t;
  const length = Math.hypot(tx, ty);   // 섞으면 길이가 1보다 살짝 짧아져서 다시 1로 맞춘다
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    tx: tx / length,
    ty: ty / length,
    bridge: a.bridge,
  };
}

// ===== 의자가 트랙의 어디쯤인지 알아낸다 =====
// 길 위의 점 중에서, 직전 프레임에 있던 곳과 이어지는 점을 고른다
// (고가와 그 아래 길이 겹치는 곳에서 "아래층인지 위층인지"를 헷갈리지 않으려고)
function updateChairTrack() {
  const cx = chairX + CHAIR_SIZE / 2;
  const cy = chairY + CHAIR_SIZE / 2;

  // 1) 직전에 있던 트랙 점 앞뒤 TRACK_SEARCH개 중에서만 가장 가까운 점을 찾는다
  //    트랙 전체에서 찾으면, 고가와 그 아래 길이 겹치는 곳에서 다른 층의 길로 건너뛰어 버린다
  //    연습 서킷은 끝과 처음이 이어져 있어서, 번호가 끝을 넘으면 처음으로 돌아가서 찾는다 (마지막 점은 처음 점과 같은 자리라 뺀다)
  const loopCount = trackSamples.length - 1;
  const from = TRACK.training ? chairTrackIndex - TRACK_SEARCH : Math.max(0, chairTrackIndex - TRACK_SEARCH);
  const to = TRACK.training ? chairTrackIndex + TRACK_SEARCH : Math.min(trackSamples.length - 1, chairTrackIndex + TRACK_SEARCH);
  let nearest = chairTrackIndex;
  let nearestDist = Infinity;
  for (let k = from; k <= to; k++) {
    const i = TRACK.training ? ((k % loopCount) + loopCount) % loopCount : k;
    const dx = trackSamples[i].x - cx;
    const dy = trackSamples[i].y - cy;
    const dist = dx * dx + dy * dy;   // 거리의 제곱 (비교만 하니 제곱근을 안 구해도 된다)
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = i;
    }
  }
  chairTrackIndex = nearest;
  const p = trackSamples[nearest];
  chairS = p.s;
  chairOnBridge = p.bridge;

  // 2) 가드레일: 의자 몸통이 인도 바깥 끝(가드레일)을 넘으면 안쪽으로 되돌린다
  const limit = ROAD_HALF + SIDEWALK_WIDTH - CHAIR_HITBOX / 2;   // 길 가운데에서 의자 중심이 갈 수 있는 거리
  const dist = Math.sqrt(nearestDist);
  if (dist > limit) {
    // 길 가운데 → 의자 쪽 방향 (길이 1). 이 방향이 "바깥"이다
    const outX = (cx - p.x) / dist;
    const outY = (cy - p.y) / dist;
    // 넘어간 만큼 안쪽으로 밀어 넣는다
    chairX = chairX - outX * (dist - limit);
    chairY = chairY - outY * (dist - limit);
    // 바깥으로 가던 속도는 없애고 조금 안쪽으로 튕긴다 (내적: 속도 중 바깥 방향 몫)
    const outSpeed = chairVX * outX + chairVY * outY;
    if (outSpeed > 0) {
      chairVX = chairVX - outX * outSpeed * (1 + WALL_BOUNCE);
      chairVY = chairVY - outY * outSpeed * (1 + WALL_BOUNCE);
    }
    // 가드레일에 긁히는 동안은 느려진다
    chairVX = chairVX * WALL_FRICTION;
    chairVY = chairVY * WALL_FRICTION;
  }
}

// ===== 의자가 지금 고가 아래를 지나는 중인가 =====
// 고가가 의자 바로 위를 덮고 있고, 그 고가가 지금 달리는 길과 이어진 부분이 아니어야 한다
// (고가로 올라가기 직전 코너에서는 고가가 가깝지만, 지금 달리는 길과 이어져 있으니 "아래"가 아니다)
function isChairUnderBridge() {
  if (chairOnBridge) return false;
  const cx = chairX + CHAIR_SIZE / 2;
  const cy = chairY + CHAIR_SIZE / 2;
  const cover = ROAD_HALF + SIDEWALK_WIDTH + RAIL_WIDTH + CHAIR_SIZE / 2;   // 고가 폭 반 + 의자 반
  for (let i = 0; i < trackSamples.length; i += 2) {
    const q = trackSamples[i];
    if (!q.bridge) continue;
    if (Math.abs(i - chairTrackIndex) <= TRACK_SEARCH) continue;   // 지금 달리는 길과 이어진 고가는 빼고
    if (Math.hypot(q.x - cx, q.y - cy) < cover) return true;
  }
  return false;
}

// ===== 이 위치가 고가도로 가까이(margin 안)에 있는가 =====
function isNearBridge(x, y, margin) {
  for (let i = 0; i < trackSamples.length; i += 4) {
    const q = trackSamples[i];
    if (q.bridge && Math.abs(q.x - x) < margin && Math.abs(q.y - y) < margin) return true;
  }
  return false;
}

// ===== 자동차의 자리와 방향 =====
// 그리기와 충돌 판정이 같은 계산을 써야 그림과 판정 영역이 어긋나지 않는다
// s: 트랙 거리 / lane: 1 = 진행 방향 오른쪽 차선, -1 = 왼쪽 차선 / forward: 트랙 방향으로 가는 차인가
function carPose(s, lane, forward) {
  let p = pointAt(s);
  if (s > TRACK_LENGTH) {
    // 결승을 지난 차: 트랙 끝 방향으로 그대로 더 나아간 자리 (강의실 건물 안으로 들어간다)
    p = { x: p.x + p.tx * (s - TRACK_LENGTH), y: p.y + p.ty * (s - TRACK_LENGTH), tx: p.tx, ty: p.ty, bridge: p.bridge };
  }
  // 자동차 그림은 앞이 위쪽이다. 트랙 방향으로 돌리고, 마주 오는 차는 180도 더 돌린다
  let angle = Math.atan2(p.tx, -p.ty);
  if (!forward) {
    angle = angle + Math.PI;
  }
  return {
    x: p.x - p.ty * lane * LANE_OFFSET,   // 차선 위치: 길 가운데에서 진행 방향의 옆으로 LANE_OFFSET만큼
    y: p.y + p.tx * lane * LANE_OFFSET,
    angle: angle,
    bridge: p.bridge,
  };
}

// ===== 충돌 판정: 두 사각형이 겹치는가 =====
// a, b는 { x, y, width, height } (x, y는 왼쪽 위 꼭짓점)
// 가로로도 겹치고 세로로도 겹치면 → 부딪힌 것이다. 네 조건이 모두 참이어야 한다
function checkCollision(a, b) {
  return a.x < b.x + b.width &&      // a의 왼쪽이 b의 오른쪽보다 왼쪽에 있고
         a.x + a.width > b.x &&      // a의 오른쪽이 b의 왼쪽보다 오른쪽에 있고
         a.y < b.y + b.height &&     // a의 위가 b의 아래보다 위에 있고
         a.y + a.height > b.y;       // a의 아래가 b의 위보다 아래에 있으면
}

// ===== 장애물에 부딪혔을 때 (기획서: 학생 = 슬로우, 자동차 = 튕겨 나가고 스턴) =====
function hitObstacle(box) {
  hitCooldown = HIT_COOLDOWN;   // 잠깐 무적
  hitMessageTimer = 50;

  if (box.type === "car") {
    // 자동차 → 의자: 자동차 가운데에서 의자 가운데로 향하는 방향으로 튕겨 나간다
    const dx = (chairX + CHAIR_SIZE / 2) - (box.x + box.width / 2);
    const dy = (chairY + CHAIR_SIZE / 2) - (box.y + box.height / 2);
    const length = Math.hypot(dx, dy) || 1;   // 0으로 나누지 않게 (완전히 겹쳤으면 1)
    chairVX = dx / length * CAR_BOUNCE;
    chairVY = dy / length * CAR_BOUNCE;
    stunTimer = STUN_FRAMES;
    flashTimer = 15;
    hitMessage = "쾅! 스턴";
    playSound("crash");
  } else {
    // 학생·콘 → 슬로우: 속도를 확 줄이고 한동안 느리게
    chairVX = chairVX * 0.3;
    chairVY = chairVY * 0.3;
    slowTimer = SLOW_FRAMES;
    hitMessage = "슬로우!";
    playSound("bump");
    // 콘은 튕겨 나가서 사라진다 (배열에서 빼낸다)
    if (box.type === "cone") {
      cones.splice(box.index, 1);
    }
  }
}

// ===== 가운데 (cx, cy)에 놓인 w×h 사각형 =====
function boxAround(cx, cy, w, h) {
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

// ===== 의자 판정 사각형 =====
function getChairHitbox() {
  return boxAround(chairX + CHAIR_SIZE / 2, chairY + CHAIR_SIZE / 2, CHAIR_HITBOX, CHAIR_HITBOX);
}

// ===== 장애물 판정 사각형 전부 (자동차·콘·건너는 학생·인도 학생) =====
// 하나마다 { x, y, width, height, type: 무엇인지, bridge: 고가 위인지, index: 배열 몇 번째인지 }
function getObstacleHitboxes() {
  const boxes = [];

  // 자동차: 돌아가 있으니, 돌아간 차를 감싸는 사각형의 가로·세로를 계산한다
  // (세로로 선 차는 좁고 길게, 가로로 누운 차는 넓고 짧게)
  for (let i = 0; i < cars.length; i++) {
    const pose = carPose(cars[i].s, cars[i].lane, cars[i].speed > 0);
    const w = CAR_WIDTH - CAR_HITBOX_SHRINK;
    const h = CAR_HEIGHT - CAR_HITBOX_SHRINK;
    const cos = Math.abs(Math.cos(pose.angle));
    const sin = Math.abs(Math.sin(pose.angle));
    const box = boxAround(pose.x, pose.y, w * cos + h * sin, w * sin + h * cos);
    box.type = "car";
    box.bridge = pose.bridge;
    box.index = i;
    boxes.push(box);
  }

  // 공사 콘
  for (let i = 0; i < cones.length; i++) {
    const pos = trackPosition(cones[i].s, cones[i].offset);
    const box = boxAround(pos.x, pos.y, CONE_HITBOX, CONE_HITBOX);
    box.type = "cone";
    box.bridge = false;
    box.index = i;
    boxes.push(box);
  }

  // 횡단보도를 건너는 학생
  for (let i = 0; i < crossers.length; i++) {
    const pos = trackPosition(crossers[i].s, crossers[i].offset);
    const box = boxAround(pos.x, pos.y, STUDENT_HITBOX, STUDENT_HITBOX);
    box.type = "student";
    box.bridge = false;
    box.index = i;
    boxes.push(box);
  }

  // 인도를 걷는 학생 (인도로 올라가면 부딪힐 수 있다)
  for (let i = 0; i < students.length; i++) {
    const pos = trackPosition(students[i].s, students[i].side * (ROAD_HALF + SIDEWALK_WIDTH / 2));
    const box = boxAround(pos.x, pos.y, STUDENT_HITBOX, STUDENT_HITBOX);
    box.type = "student";
    box.bridge = false;
    box.index = i;
    boxes.push(box);
  }
  return boxes;
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
    if (TRACK.training) break;   // 연습 서킷에는 학생이 없다
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

// ===== min ~ max 사이의 아무 수 =====
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ===== 트랙 거리 s 지점에서 길 가운데로부터 옆으로 offset만큼 떨어진 곳의 맵 좌표 =====
// offset 양수 = 진행 방향 오른쪽, 음수 = 왼쪽 (진행 방향의 오른쪽 옆 = (-ty, tx))
function trackPosition(s, offset) {
  const p = pointAt(s);
  return { x: p.x - p.ty * offset, y: p.y + p.tx * offset };
}

// ===== 장애물을 놓아도 되는 곧은 땅 위 길인가 =====
// s 앞뒤 halfLength 안에서 길이 휘지 않고, 고가 위도 아니고, 고가와 가깝지도 않아야 한다
function isStraightGround(s, halfLength) {
  const center = pointAt(s);
  for (const d of [-halfLength, 0, halfLength]) {
    const p = pointAt(s + d);
    if (p.bridge) return false;
    if (p.tx * center.tx + p.ty * center.ty < 0.999) return false;   // 방향이 달라졌으면 휘는 곳
  }
  // 고가도로 바로 아래(또는 옆)도 피한다 (고가에 가려서 안 보이니까)
  for (let i = 0; i < trackSamples.length; i += 4) {
    const q = trackSamples[i];
    if (q.bridge && Math.hypot(q.x - center.x, q.y - center.y) < (ROAD_HALF + SIDEWALK_WIDTH) * 2 + 100) return false;
  }
  return true;
}

// ===== 횡단보도 자리 찾기 (시작할 때 한 번) =====
// CROSSWALK_GAP마다, 곧은 땅 위 길이 나올 때까지 조금씩 앞으로 가며 찾는다
function findCrosswalks() {
  const list = [];
  if (TRACK.training) return list;   // 연습 서킷에는 횡단보도(건너는 학생)가 없다
  let s = START_LINE_S + 1400;
  while (s < TRACK_LENGTH - 700) {
    if (isStraightGround(s, 150)) {
      list.push(s);
      s = s + CROSSWALK_GAP;
    } else {
      s = s + 50;
    }
  }
  return list;
}

// ===== 자동차 만들기 =====
// 짝수 번째는 같은 방향 차, 홀수 번째는 마주 오는 차. 처음 위치와 속도는 조금씩 다르게
// ===== 자동차가 다시 나타날 빈자리: s 근처에서 같은 차선 차들과 CAR_GAP의 2배 이상 떨어진 곳 =====
// s → 조금 앞 → 조금 뒤 → 더 앞 → 더 뒤 … 순서로 찾아보고, 끝까지 없으면 그냥 s
function freeCarSpot(s, self) {
  for (let k = 0; k < 12; k++) {
    const step = Math.ceil(k / 2) * CAR_GAP * 2 * (k % 2 === 1 ? 1 : -1);
    const tryS = s + step;
    let free = true;
    for (const other of cars) {
      if (other !== self && other.lane === self.lane && Math.abs(other.s - tryS) < CAR_GAP * 2) free = false;
    }
    if (free) return tryS;
  }
  return s;
}

function createCars() {
  cars = [];
  for (let i = 0; i < CAR_COUNT; i++) {
    if (i % 2 === 0) {
      cars.push({ s: START_LINE_S + 1500 + i * 900, speed: randomBetween(5.5, 7), lane: 1 });
    } else {
      cars.push({ s: START_LINE_S + 2500 + i * 900, speed: -randomBetween(5, 6.5), lane: -1 });
    }
  }
}

// ===== 공사 콘 만들기 =====
// 출발선 뒤쪽 ~ 결승 앞 사이의 땅 위 차도에 아무렇게나 놓는다. 횡단보도 근처와 고가는 피한다
function createCones() {
  cones = [];
  let tries = 0;
  while (cones.length < CONE_COUNT && tries < 1000) {
    tries = tries + 1;
    const s = randomBetween(START_LINE_S + 600, TRACK_LENGTH - 400);
    if (pointAt(s).bridge) continue;
    const pos = trackPosition(s, 0);
    if (isNearBridge(pos.x, pos.y, (ROAD_HALF + SIDEWALK_WIDTH) * 2)) continue;   // 고가 아래는 가려지니까 피한다
    let nearCrosswalk = false;
    for (let i = 0; i < crosswalks.length; i++) {
      if (Math.abs(crosswalks[i] - s) < 150) nearCrosswalk = true;
    }
    if (nearCrosswalk) continue;
    cones.push({ s: s, offset: randomBetween(-(ROAD_HALF - 20), ROAD_HALF - 20) });
  }
}

// ===== 건너는 학생 만들기: 횡단보도마다 몇 명씩, 서로 다른 자리와 속도로 =====
function createCrossers() {
  crossers = [];
  for (let i = 0; i < crosswalks.length; i++) {
    for (let k = 0; k < CROSSERS_PER_CROSSWALK; k++) {
      // 첫 번째는 왼쪽 절반에서 오른쪽으로, 두 번째는 오른쪽 절반에서 왼쪽으로 → 서로 엇갈려 걷는다
      // 진행 방향으로 ±20씩 떨어져 서서 (학생 몸 두께 36) 엇갈릴 때도 겹치지 않는다
      const speed = randomBetween(0.8, 1.4);
      if (k % 2 === 0) {
        crossers.push({ s: crosswalks[i] - 20, offset: randomBetween(-CROSS_RANGE, 0), speed: speed });
      } else {
        crossers.push({ s: crosswalks[i] + 20, offset: randomBetween(0, CROSS_RANGE), speed: -speed });
      }
    }
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
  for (const side of [-7, 7]) {            // 왼쪽 바퀴(-7), 오른쪽 바퀴(7) (3D 의자 크기에 맞춤)
    const back = 9;                        // 뒤쪽으로 9
    wheels.push({
      x: centerX + side * cos - back * sin,
      y: centerY + side * sin + back * cos,
    });
  }
  return wheels;
}

// =====================================================================
// ===== 8장: 2D 버전에서 그대로 가져온 함수들 (랩, 일시 정지, 카메라, 소리) =====
// =====================================================================

// ===== 연습 서킷 랩 재기 (달리는 중 매 프레임) =====
function updateLaps() {
  // 이번 프레임에 트랙을 따라 간 거리. 끝 → 처음으로 넘어가면 숫자가 확 바뀌니 한 바퀴만큼 보정한다
  let delta = chairS - lapLastS;
  if (delta > TRACK_LENGTH / 2) delta = delta - TRACK_LENGTH;
  if (delta < -TRACK_LENGTH / 2) delta = delta + TRACK_LENGTH;
  lapLastS = chairS;
  lapDistance = lapDistance + delta;

  // 출발선을 지나 한 바퀴를 채울 때마다 1랩
  const done = lapDistance >= LAP_LINE_OFFSET ? Math.floor((lapDistance - LAP_LINE_OFFSET) / TRACK_LENGTH) : 0;
  if (done > lapsDone) {
    lapsDone = done;
    lastLapSeconds = (Date.now() - lapStartTime) / 1000;
    lapStartTime = Date.now();
    const record = saveBestLap(TRACK_INDEX, lastLapSeconds);
    launchText = record ? "랩 신기록! " + lastLapSeconds.toFixed(2) + "초" : "랩 " + lastLapSeconds.toFixed(2) + "초";
    launchMessageTimer = 90;
    playSound(record ? "record" : "finish");
  }
}

// ===== 연습 서킷 최고 랩 (브라우저에 저장, 짧을수록 좋다) =====
function loadBestLap(index) {
  try {
    return Number(localStorage.getItem("chairDrift.bestLap." + index)) || 0;   // 없으면 0
  } catch (e) {
    return 0;
  }
}

// 더 짧은 기록이면 저장하고 true를 돌려준다
function saveBestLap(index, seconds) {
  const best = loadBestLap(index);
  if (best > 0 && seconds >= best) return false;
  try {
    localStorage.setItem("chairDrift.bestLap." + index, seconds.toFixed(2));
  } catch (e) {
    // 저장소를 못 쓰면 저장만 건너뛴다
  }
  return true;
}

// ===== 시계 밀기: 멈춰 있던 시간(ms)만큼 시작 시각들을 뒤로 → 멈춘 동안 시간이 안 흐른 것처럼 =====
// 탭을 숨겼다 돌아올 때와 일시 정지에서 계속할 때 쓴다
function shiftClocks(ms) {
  startTime = startTime + ms;           // 제한 시간
  countdownStart = countdownStart + ms; // 3, 2, 1 카운트다운
  goTime = goTime + ms;                 // GO! 글자와 출발 부스터 판정
  lapStartTime = lapStartTime + ms;     // 연습 서킷 랩 시계
  if (upPressTime !== 0) upPressTime = upPressTime + ms;
}

// ===== 일시 정지 / 계속 / 메뉴 고르기 =====
function pauseGame() {
  pausedFrom = gameState;
  gameState = "paused";
  pausedAt = Date.now();
  pauseIndex = 0;
  for (const key in keys) {
    keys[key] = false;   // 누르고 있던 키는 뗀 것으로 (계속했을 때 혼자 달려 나가지 않게)
  }
}

function resumeGame() {
  shiftClocks(Date.now() - pausedAt);
  gameState = pausedFrom;
}

function choosePauseOption() {
  if (pauseIndex === 0) {
    resumeGame();
  } else if (pauseIndex === 1) {
    resetGame();             // 처음부터 다시 (3, 2, 1부터)
  } else {
    menuIndex = TRACK_INDEX;
    gameState = "select";
  }
}

// ===== 카메라가 따라갈 방향 (0 = 맵 위쪽) =====
// 평소: 의자가 바라보는 방향
// 드리프트 중: 바라보는 방향과 실제로 미끄러져 가는 방향의 가운데 (의자가 확 틀어져도 화면이 덜 휘둘린다)
// 스턴 중: 지금 화면 방향 그대로 (빙글 도는 의자를 따라 화면이 돌면 제일 어지럽다)
function cameraTargetAngle() {
  if (stunTimer > 0) return cameraAngle;
  const speed = Math.hypot(chairVX, chairVY);
  if (isDrifting && speed > DRIFT_MIN_SPEED) {
    const moveAngle = Math.atan2(chairVX, -chairVY);   // 실제로 움직이는 방향
    return chairAngle + angleDiff(moveAngle, chairAngle) * CAMERA_DRIFT_BLEND;
  }
  return chairAngle;
}

// ===== 카메라 돌리기 (매 프레임): 목표 방향 쪽으로 차이의 일부만, 그것도 최대 CAMERA_MAX_TURN까지만 =====
// 한 번에 다 돌지 않으니 부드럽고, 최대치가 있으니 의자가 휙 돌아도 화면은 천천히 따라온다
function updateCamera() {
  const turn = angleDiff(cameraTargetAngle(), cameraAngle) * CAMERA_TURN_FOLLOW;
  cameraAngle = cameraAngle + Math.max(-CAMERA_MAX_TURN, Math.min(CAMERA_MAX_TURN, turn));
}

// ===== 소리 장치 켜기: 키를 누를 때마다 불린다 (이미 켜져 있으면 아무것도 안 한다) =====
function unlockAudio() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;   // 소리를 못 내는 브라우저면 소리 없이
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {
    audioCtx = null;   // 소리 장치를 못 만들어도 게임은 계속
  }
}

// ===== 삑 소리 하나: freq(높이, Hz)에서 시작해 endFreq로 미끄러지며 ms 동안, volume으로 =====
// type: "sine"(부드럽게) / "square"(삑삑) / "sawtooth"(지잉) / "triangle"(통통)
// delay만큼 늦게 시작한다 (멜로디를 만들 때)
function playTone(freq, endFreq, ms, type, volume, delay) {
  const start = audioCtx.currentTime + (delay || 0) / 1000;
  const end = start + ms / 1000;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(endFreq, end);
  gain.gain.setValueAtTime(volume * SOUND_VOLUME, start);
  gain.gain.exponentialRampToValueAtTime(0.001, end);   // 점점 작아지며 끝난다 (뚝 끊기는 소리 없이)
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(end);
}

// ===== 치익 소리: 무작위 잡음 (부딪히는 소리) =====
function playNoise(ms, volume) {
  const length = Math.floor(audioCtx.sampleRate * ms / 1000);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);   // 뒤로 갈수록 작게
  }
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  gain.gain.value = volume * SOUND_VOLUME;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

// ===== 효과음 재생: 이름으로 부른다. 음소거거나 소리 장치가 없으면 조용히 넘어간다 =====
// 소리마다 새로 만들어서 재생하니까, 빠르게 연달아 나도 끊기지 않고 겹쳐서 난다
function playSound(name) {
  if (isMuted || !audioCtx) return;
  try {
    if (name === "count") playTone(440, 440, 150, "square", 0.5);         // 3, 2, 1: 짧은 삑
    if (name === "go") playTone(880, 880, 400, "square", 0.5);            // GO!: 높고 긴 삑
    if (name === "bump") playTone(260, 120, 120, "triangle", 0.9);        // 학생·콘: 통
    if (name === "crash") {                                               // 자동차: 쾅
      playNoise(300, 0.8);
      playTone(150, 50, 300, "sawtooth", 0.6);
    }
    if (name === "boost") playTone(200, 900, 450, "sawtooth", 0.35);      // 부스터: 지이잉 올라가는 소리
    if (name === "finish" || name === "record") {                        // 도착: 도-미-솔-도
      const notes = [523, 659, 784, 1047];
      for (let i = 0; i < notes.length; i++) {
        playTone(notes[i], notes[i], 180, "triangle", 0.7, i * 120);
      }
      if (name === "record") playTone(1319, 1319, 400, "triangle", 0.7, 520);   // 신기록이면 한 음 더
    }
    if (name === "gameover") {                                            // 시간 초과: 내려가는 음
      playTone(392, 392, 250, "square", 0.4);
      playTone(330, 330, 250, "square", 0.4, 250);
      playTone(262, 196, 500, "square", 0.4, 500);
    }
  } catch (e) {
    // 소리에 문제가 생겨도 게임은 멈추지 않게
  }
}

// ===== 음소거 상태 저장·불러오기 (브라우저에 저장) =====
function loadMuted() {
  try {
    return localStorage.getItem("chairDrift.muted") === "true";   // 저장된 건 글자라서 "true"와 비교한다
  } catch (e) {
    return false;
  }
}

function saveMuted(value) {
  try {
    localStorage.setItem("chairDrift.muted", String(value));
  } catch (e) {
    // 저장소를 못 쓰면 저장만 건너뛴다
  }
}
