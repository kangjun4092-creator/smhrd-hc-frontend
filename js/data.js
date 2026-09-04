// data.js — 정적 데이터/카탈로그 (종목, 일간 미션 템플릿, 지역 데이터 등). state.js가 이 파일의 generateSquatMissions()를 즉시 호출하므로 반드시 state.js보다 먼저 로드되어야 합니다.

const EXS = [
  {id:'squat', name:'스쿼트', target:'하체 · 둔근', level:'초급'},
];

// 스쿼트만 등록된 상태라 미션도 스쿼트 지표로만 구성한다. metric은 saveExerciseResult()에서
// 세션이 끝날 때마다 누적되는 공용 카운터(state.missions.counters)를 가리킨다.
// 미션은 일간만 운영한다(주간/월간 폐지) — 운동 탭 종목선택 화면에서 바로 진행 상황을
// 보여주는 구조로 바뀌면서, 여러 기간을 동시에 굴릴 필요가 없어졌다.
const SQUAT_MISSION_TEMPLATES = [
  {metric:'reps', label:t=>`스쿼트 ${t}회 달성`, ranges:{daily:[15,30]}, rewardPerUnit:2.5},
  {metric:'perfect', label:t=>`스쿼트 퍼펙트 ${t}개 만들기`, ranges:{daily:[3,8]}, rewardPerUnit:4},
  {metric:'sessions', label:t=>`스쿼트 세트 ${t}회 완료`, ranges:{daily:[1,2]}, rewardPerUnit:35},
  {metric:'missFreeSession', label:t=>`MISS 0회 세트 ${t}회 달성`, ranges:{daily:[1,1]}, rewardPerUnit:45},
  {metric:'accSession', label:t=>`정확도 90% 이상 세트 ${t}회`, ranges:{daily:[1,2]}, rewardPerUnit:38},
];
function randInt(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
// 후보 템플릿 중 무작위로 count개를 뽑아 목표치를 굴려서 미션 인스턴스를 만든다(중복 템플릿
// 허용 — 목표치는 매번 다시 굴리므로 완전히 같은 미션이 되진 않는다).
function generateSquatMissions(period, count){
  const list=[];
  for(let i=0;i<count;i++){
    const tpl=SQUAT_MISSION_TEMPLATES[Math.floor(Math.random()*SQUAT_MISSION_TEMPLATES.length)];
    const [lo,hi]=tpl.ranges[period];
    const target=randInt(lo,hi);
    const reward=Math.round(target*tpl.rewardPerUnit/10)*10;
    list.push({id:`${period}-${i}-${tpl.metric}`, period, metric:tpl.metric, target, label:tpl.label(target), reward});
  }
  return list;
}

// 아이디·닉네임·크루명 중복확인용 목업 데이터. 실제로는 DB 조회(SQL SELECT ... WHERE)로 대체된다.
const EXISTING_USERS = [
  {id:'hometrainer01', nickname:'써니핏'},
  {id:'runner99', nickname:'런닝수달'},
  {id:'proteinman', nickname:'단백질맨'},
];
const REGION_DATA = {
  '서울시': { '강남구':['역삼동','삼성동'], '마포구':['합정동','망원동'], '성동구':['성수동'] },
  '부산시': { '해운대구':['우동','중동'] },
  '대전시': { '유성구':['봉명동'] },
  '전남광주통합특별시': { '북구':['오룡동'], '서구':['상무동'] },
};
// renderSignup ~ setSignupDong 구간: 화면(입력 폼) 렌더링만 담당하는 순수 프론트엔드 로직.
// (FR-AC-001) 실제 "가입 제출" 처리는 아래 doSignup() 지점에서 이어집니다.
