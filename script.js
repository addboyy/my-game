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

// 플레이어(의자): 32×32, 화면 중간 아래부분
const CHAIR_X = 384;      // 왼쪽 위 꼭짓점 x
const CHAIR_Y = 500;      // 왼쪽 위 꼭짓점 y
const CHAIR_SIZE = 32;

// 다른 학생: 위에서 본 초록 옷 학생 (x, y는 "중심")
const STUDENT_WIDTH = 52;
const STUDENT_HEIGHT = 36;
const STUDENTS = [
  { x: 250, y: 330 },
  { x: 520, y: 240 },
  { x: 420, y: 200 },
];

// 자동차: 40×70
const CAR_X = 560;
const CAR_Y = 360;
const CAR_WIDTH = 40;
const CAR_HEIGHT = 70;

// 강의실 문: 노란 사각형 + "강의실" 글자 (건물 아래쪽에 붙어 있다)
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
    // 마지막 이미지까지 다 불러왔으면 화면을 그린다
    if (loadedCount === allImages.length) {
      drawScreen();
    }
  };
}

// src를 정하는 순간 불러오기가 시작된다 (파일 이름은 영어 소문자)
chairImage.src = "images/chair.svg";
carImage.src = "images/car.png";
studentImage.src = "images/student.png";
treeImage.src = "images/tree.png";
grassImage.src = "images/grass.png";

// ===== 화면 그리기 =====

function drawScreen() {
  // ----- 1. 잔디 (양쪽) -----
  // [새로 시도] 패턴: 작은 잔디 그림을 타일처럼 반복해서 칠한다
  ctx.fillStyle = ctx.createPattern(grassImage, "repeat");
  ctx.fillRect(0, 0, GRASS_WIDTH, 600);                  // 왼쪽 잔디
  ctx.fillRect(800 - GRASS_WIDTH, 0, GRASS_WIDTH, 600);  // 오른쪽 잔디

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
  for (const student of STUDENTS) {
    // 이미지는 왼쪽 위 꼭짓점 기준이라, 중심 (x, y)에서 반만큼 빼서 그린다
    ctx.drawImage(
      studentImage,
      student.x - STUDENT_WIDTH / 2,
      student.y - STUDENT_HEIGHT / 2,
      STUDENT_WIDTH,
      STUDENT_HEIGHT
    );
  }

  // ----- 9. 자동차 -----
  ctx.drawImage(carImage, CAR_X, CAR_Y, CAR_WIDTH, CAR_HEIGHT);

  // ----- 10. 플레이어 의자 -----
  ctx.drawImage(chairImage, CHAIR_X, CHAIR_Y, CHAIR_SIZE, CHAIR_SIZE);

  // ----- 11. 글자: 남은 시간 (화면 위 가운데) -----
  // 글자가 잘 보이게 뒤에 반투명 검은 띠를 깐다
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(310, 10, 180, 36);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("남은 시간 " + TIME_LEFT + "초", 400, 28);

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
}
