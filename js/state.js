// state.js — 앱 전체 상태(state) 단일 객체. 지금은 이 객체 하나가 서버·DB 역할을 대신합니다. data.js 다음에 로드되어야 합니다.

const state = {
  screen: 'intro', // intro | signup | login | app
  // 로그인 전 랜딩 카드를 누르면 회원가입 없이도 screen='app'으로 들어가 로그인했을 때와 똑같은
  // 전체 카테고리(사이드바)를 그대로 둘러볼 수 있다 — 이 플래그는 "계정에 실제로 뭔가 남기는
  // 액션"만 로그인으로 유도하기 위한 표시일 뿐, 화면 라우팅 자체는 바꾸지 않는다(startGuestExercise/
  // startGuestCrew, renderMain/renderCrewJoin/renderExStepSave의 guestMode 분기 참고).
  guestMode: false,
  signup: {
    id:'', pw:'', pw2:'', nickname:'', email:'',
    regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동', gender:'male', calibrated:false,
    calModalOpen:false, calStage:'idle', calProfile:null, calError:'',
  },
  user: {nickname:'', avatar:0, gender:'male', points:1240, exp:62, level:7, region:'서울시 강남구 역삼동', retakeTickets:0, nicknameTickets:0, bio:'',
    streak:10, streakRewardClaimed:false, extraSets:0, setsUsedToday:0},
  menu: 'main',
  subtabs: {mission:0, profile:0, crew:0, ranking:0},
  exercise: {step:0, picked:null, camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[], replayOpen:false},
  crewBattle: null, // 5vs5 크루대전 진행 중 상태 — startCrewBattle() 참고
  crewParty: {open:false, statusOpen:false, selected:[], invites:null, ready:false, tickId:null}, // 크루대전 파티맺기 — openPartyInvite() 참고
  missions: {
    list: {
      daily: generateSquatMissions('daily',3),
    },
    // 미션이 공유하는 누적 카운터. saveExerciseResult()에서 스쿼트 세션이 저장될 때마다 갱신된다.
    counters: {reps:0, perfect:0, sessions:0, missFreeSession:0, accSession:0},
    claimed: {}, // {missionId: true} — 보상 중복 수령 방지
  },
  // levelReq: 이 레벨에 도달해야 상점에서 구매할 수 있는 아이템 — 지금은 메인 화면의 "다음
  // 레벨업 혜택" 미리보기(getItemsUnlockedAtLevel)에서만 쓰고, 상점 구매 자체를 막지는 않는다
  // (기존 구매 로직까지 건드리면 범위가 커지므로, 우선 안내용으로만 노출).
  shopItems: [
    {name:'다시찍기 티켓', price:80, owned:false, consumable:true, category:'기타', levelReq:1, effect:'재촬영 1회 추가', effectDesc:'세션당 무료 재촬영 2회를 모두 쓴 뒤, 추가로 다시 촬영할 때 1장씩 소모됩니다. 결과를 확인하며 반복 재촬영으로 정확도를 올리는 것을 막기 위한 아이템이에요.'},
    {name:'네온 트레이닝복', price:300, owned:false, equipped:false, slot:'outfit', category:'의상', levelReq:5, effect:'판정 관대도 +3%', effectDesc:'경계선 각도의 자세를 GOOD 이상으로 인정할 확률이 올라갑니다.'},
    {name:'금빛 뱃지 프레임', price:450, owned:false, equipped:false, slot:'badge', category:'의상', levelReq:6, effect:'미션 포인트 +10%', effectDesc:'모든 미션 달성 보상 포인트에 10% 추가 지급됩니다.'},
    {name:'챔피언 왕관', price:900, owned:false, equipped:false, slot:'crown', category:'의상', levelReq:10, effect:'랭킹 점수 +5%', effectDesc:'지역·종목 랭킹에 반영되는 점수가 5% 가산됩니다.'},
    {name:'프로필 배경 - 새벽 러닝', price:250, owned:true, equipped:true, slot:'background', category:'배경', levelReq:3, effect:'출석 보너스 +5P/일', effectDesc:'연속 출석일마다 기본 출석 포인트에 5P가 추가됩니다.'},
    {name:'프로필 배경 - 노을 진 공원', price:300, owned:false, equipped:false, slot:'background', category:'배경', levelReq:4, effect:'미션 포인트 +5%', effectDesc:'일간 미션 달성 보상 포인트에 5%가 추가됩니다.'},
    {name:'프로필 배경 - 도심 야경', price:400, owned:false, equipped:false, slot:'background', category:'배경', levelReq:7, effect:'랭킹 점수 +3%', effectDesc:'지역·종목 랭킹에 반영되는 점수가 3% 가산됩니다.'},
    {name:'캐릭터 - 로봇 코치', price:600, owned:false, equipped:false, slot:'skin', category:'의상', levelReq:8, effect:'준비 카운트다운 -1초', effectDesc:'촬영 시작 전 정렬 확인 후 나오는 카운트다운이 1초 짧아집니다.'},
    {name:'닉네임 컬러 이펙트', price:180, owned:true, equipped:true, slot:'nickname', category:'기타', levelReq:2, effect:'능력치 없음 · 외형 전용', effectDesc:'랭킹에서 닉네임 색상만 강조되며 점수에는 영향이 없습니다.'},
    {name:'닉네임 변경권', price:150, owned:false, consumable:true, category:'기타', levelReq:1, effect:'닉네임 변경 1회', effectDesc:'설정에서 닉네임을 한 번 변경할 수 있습니다. 무분별한 닉네임 변경으로 랭킹 혼선이 생기는 것을 막기 위한 아이템이에요.'},
    {name:'세트 추가권', price:200, owned:false, consumable:true, category:'기타', levelReq:1, effect:'일일 운동세트 +3', effectDesc:'하루에 가능한 운동세트 한도가 3세트 늘어납니다. 레벨이 오르면(5레벨마다) 기본 세트 한도도 자동으로 늘어나요.'},
  ],
  shopFilter: '전체',
  itemPreview: {open:false, idx:null},
  crew: {
    created:false, name:'', desc:'', region:'', concepts:[],
    members:[],
    notices:[
      {who:'써니핏', title:'우리 크루 단톡방 안내', body:"카카오톡 오픈채팅방에서 '123' 검색해서 들어와주세요!", date:'08.20'},
    ],
    joinRequests:[
      {n:'배드민턴킹', level:5, score:1800, msg:'매일 저녁 운동 인증하려고 합니다. 잘 부탁드려요!'},
      {n:'헬린이탈출', level:3, score:960, msg:'초보인데 열심히 하겠습니다!'},
    ],
    chat: {
      messages:[
        {who:'써니핏', mine:false, text:'다들 오늘 미션 화이팅!', time:'09:12'},
        {who:'헬스왕', mine:false, text:'저 방금 완료했어요 💪', time:'09:20'},
      ],
    },
    groupMission: {period:'daily', ex:'스쿼트', totalTarget:300},
    teamProgress:64,
    level:1, exp:0,
    rankCity:null, rankGu:null, rankDong:null, mapCity:null, mapGu:null,
  },
  history: [
    {date:'08.22', ex:'스쿼트', reps:32, acc:91, score:412, grade:'GREAT', gc:{PERFECT:14,GREAT:15,GOOD:3,MISS:2}},
    {date:'08.22', ex:'런지', reps:18, acc:84, score:250, grade:'GOOD', gc:{PERFECT:2,GREAT:8,GOOD:8,MISS:1}},
    {date:'08.20', ex:'플랭크', reps:1, acc:88, score:260, grade:'GOOD', gc:{PERFECT:0,GREAT:0,GOOD:1,MISS:0}},
    {date:'08.18', ex:'런지', reps:24, acc:95, score:388, grade:'PERFECT', gc:{PERFECT:20,GREAT:3,GOOD:1,MISS:1}},
  ],
  settings: {
    account:{nickname:'', regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동'},
  },
  support: {
    composerOpen:false,
    filter:'all',
    tickets:[
      {id:3,type:'Error',title:'웹캠 촬영 중 화면이 멈춰요',body:'스쿼트 촬영 20초쯤 지나면 화면이 멈추고 리플레이로 넘어가지 않습니다.',status:'답변완료',date:'08.21',
        reply:'브라우저 캐시 문제로 확인되었습니다. 카메라 권한을 껐다 켠 뒤 다시 시도해주세요. 동일 증상이 반복되면 다시 접수 부탁드립니다.'},
      {id:2,type:'기능제안',title:'홈크루 인원을 6명까지 늘려주세요',body:'현재 4명 제한인데 동네 모임 특성상 6명까지는 열어주시면 좋겠습니다.',status:'처리중',date:'08.22', reply:''},
      {id:1,type:'기타',title:'포인트 상점 아이템 효과가 안 보여요',body:'구매 전에 아이템 효과를 알 수 있으면 좋겠습니다.',status:'접수',date:'08.23', reply:''},
    ],
  },
  confirm: null,
  findIdModal: {open:false, result:null},
  findPwModal: {open:false, done:false},
  rankFilter: {city:null, gu:null, dong:null},
  exRankFilter: {city:null, gu:null, dong:null, ex:null},
};

