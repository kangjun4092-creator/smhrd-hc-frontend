// state.js — 앱 전체 상태(state) 단일 객체. 지금은 이 객체 하나가 서버·DB 역할을 대신합니다. data.js 다음에 로드되어야 합니다.

const state = {
  screen: 'intro', // intro | signup | login | app
  // 로그인 전 랜딩 카드를 누르면 회원가입 없이도 screen='app'으로 들어가 로그인했을 때와 똑같은
  // 전체 카테고리(사이드바)를 그대로 둘러볼 수 있다 — 이 플래그는 "계정에 실제로 뭔가 남기는
  // 액션"만 로그인으로 유도하기 위한 표시일 뿐, 화면 라우팅 자체는 바꾸지 않는다(startGuestExercise/
  // startGuestCrew, renderMain/renderCrewJoin/renderExStepSave의 guestMode 분기 참고).
  guestMode: false,
  token: null,
  notifPanelOpen: false, // 상단바 알림벨 — 크루대전 파티 신청 수락/거절 알림용(crew.js의 crewParty 참고)

  signup: {
    id:'', pw:'', pw2:'', nickname:'', email:'',
    regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동', gender:'male', calibrated:false,
    calModalOpen:false, calStage:'idle', calProfile:null, calError:'',
  },
  user: {id: null, nickname:'', avatar:0, gender:'male', points:1240, exp:62, level:7, region:'서울시 강남구 역삼동', retakeTickets:0, nicknameTickets:0, bio:'',
    streak:10, streakRewardClaimed:false, extraSets:0, setsUsedToday:0, role:'USER'},
  menu: 'main',
  subtabs: {mission:0, profile:0, crew:0, ranking:0},
  exercise: {step:0, picked:null, camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[], replayOpen:false},
  crewBattle: null, // 5vs5 크루대전 진행 중 상태 — startCrewBattle() 참고
  crewParty: {open:false, statusOpen:false, selected:[], invites:null, ready:false, tickId:null}, // 크루대전 파티맺기 — openPartyInvite() 참고
  // 서버(GET /api/missions/today)에서 받아온 오늘의 미션 목록. 각 항목은 이미
  // {id, metric, label, target, current, reward, achieved, claimed}를 다 채운 상태로 온다 —
  // 진행도 계산은 백엔드(MissionService)가 담당하므로 프론트는 그대로 표시만 하면 된다.
  missions: {
    today: [],
  },
  // levelReq: 이 레벨에 도달해야 상점에서 구매할 수 있는 아이템이라는 의도로 넣어둔 데이터.
  // 메인 대시보드의 "다음 레벨업 혜택" 미리보기가 이 값을 쓰다가 카드 자체가 빠지면서(2026-09-10)
  // 지금은 실제로 읽는 곳이 없다 — 상점(shop.js) 구매 로직에서 레벨 제한으로 쓰려면 그때 연결하면 됨.
  // 서브카테고리를 (헤어/상의/하의/신발/기타)로 바꾸면서 기존 항목들도 임시로 다시 배정해뒀다 —
  // 특히 '프로필 배경' 3종은 새 카테고리 어디에도 딱 맞지 않아 일단 기타로 넣어둔 상태라,
  // 아이템 속성을 다시 정리할 때 같이 검토하면 좋을 것 같다. 지금 '하의'/'신발' 카테고리는
  // 해당하는 아이템이 아직 없어서 탭을 눌러도 비어있다.
  shopItems: [
    {name:'다시찍기 티켓', price:80, owned:false, consumable:true, category:'기타', levelReq:1, effect:'재촬영 1회 추가', effectDesc:'세션당 무료 재촬영 2회를 모두 쓴 뒤, 추가로 다시 촬영할 때 1장씩 소모됩니다. 결과를 확인하며 반복 재촬영으로 정확도를 올리는 것을 막기 위한 아이템이에요.'},
    {name:'네온 트레이닝복', price:300, owned:false, equipped:false, slot:'outfit', category:'상의', levelReq:5, effect:'능력치 없음 · 외형 전용', effectDesc:'캐릭터 외형만 바뀌며 판정·점수에는 영향이 없습니다.'},
    {name:'금빛 뱃지 프레임', price:450, owned:false, equipped:false, slot:'badge', category:'기타', levelReq:6, effect:'미션 포인트 +10%', effectDesc:'모든 미션 달성 보상 포인트에 10% 추가 지급됩니다.'},
    {name:'챔피언 왕관', price:900, owned:false, equipped:false, slot:'crown', category:'헤어', levelReq:10, effect:'랭킹 점수 +5%', effectDesc:'지역·종목 랭킹에 반영되는 점수가 5% 가산됩니다.'},
    {name:'프로필 배경 - 새벽 러닝', price:250, owned:true, equipped:true, slot:'background', category:'기타', levelReq:3, effect:'출석 보너스 +5P/일', effectDesc:'연속 출석일마다 기본 출석 포인트에 5P가 추가됩니다.'},
    {name:'프로필 배경 - 노을 진 공원', price:300, owned:false, equipped:false, slot:'background', category:'기타', levelReq:4, effect:'미션 포인트 +5%', effectDesc:'일간 미션 달성 보상 포인트에 5%가 추가됩니다.'},
    {name:'프로필 배경 - 도심 야경', price:400, owned:false, equipped:false, slot:'background', category:'기타', levelReq:7, effect:'랭킹 점수 +3%', effectDesc:'지역·종목 랭킹에 반영되는 점수가 3% 가산됩니다.'},
    {name:'캐릭터 - 로봇 코치', price:600, owned:false, equipped:false, slot:'skin', category:'기타', levelReq:8, effect:'준비 카운트다운 -1초', effectDesc:'촬영 시작 전 정렬 확인 후 나오는 카운트다운이 1초 짧아집니다.'},
    {name:'닉네임 컬러 이펙트', price:180, owned:true, equipped:true, slot:'nickname', category:'기타', levelReq:2, effect:'능력치 없음 · 외형 전용', effectDesc:'랭킹에서 닉네임 색상만 강조되며 점수에는 영향이 없습니다.'},
    {name:'닉네임 변경권', price:150, owned:false, consumable:true, category:'기타', levelReq:1, effect:'닉네임 변경 1회', effectDesc:'설정에서 닉네임을 한 번 변경할 수 있습니다. 무분별한 닉네임 변경으로 랭킹 혼선이 생기는 것을 막기 위한 아이템이에요.'},
    {name:'세트 추가권', price:200, owned:false, consumable:true, category:'기타', levelReq:1, effect:'일일 운동세트 +3', effectDesc:'하루에 가능한 운동세트 한도가 3세트 늘어납니다. 레벨이 오르면(5레벨마다) 기본 세트 한도도 자동으로 늘어나요.'},
  ],
  shopFilter: '헤어',
  itemPreview: {open:false, idx:null},
  crew: {
    created:false, name:'', desc:'', region:'', concepts:[],
    members:[],
    notices:[
      {who:'써니핏', title:'우리 크루 단톡방 안내', body:"카카오톡 오픈채팅방에서 '123' 검색해서 들어와주세요!", date:'08.20'},
    ],
    noticeEditing:false, // 크루메인의 공지 카드가 팀장에게 입력폼으로 바뀌어 있는지(renderCrewNoticeCard)
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
    // 크루원이 각자 '운동' 탭에서 이 종목을 완료할 때마다 progress가 쌓이는 크루 공용 미션.
    // 지금은 스쿼트만 있어 고정이지만, 나중에 종목이 늘어나면 매일 랜덤으로 ex를 바꿔주면 된다.
    groupMission: {ex:'스쿼트', target:300, progress:120},
    level:1, exp:0,
    rankCity:null, rankGu:null, rankDong:null,
  },
  history: [
    {date:'08.22', ex:'스쿼트', reps:32, acc:91, score:412, grade:'GREAT', gc:{PERFECT:14,GREAT:15,GOOD:3,MISS:2}},
    {date:'08.22', ex:'런지', reps:18, acc:84, score:250, grade:'GOOD', gc:{PERFECT:2,GREAT:8,GOOD:8,MISS:1}},
    {date:'08.20', ex:'플랭크', reps:1, acc:88, score:260, grade:'GOOD', gc:{PERFECT:0,GREAT:0,GOOD:1,MISS:0}},
    {date:'08.18', ex:'런지', reps:24, acc:95, score:388, grade:'PERFECT', gc:{PERFECT:20,GREAT:3,GOOD:1,MISS:1}},
  ],
  settings: {
    account:{nickname:'', regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동', profilePublic:true},
  },
  support: {
    composerOpen:false,
    filter:'all',
    tickets:[], // 서버에서 실제 내 문의 목록을 받아와 채우는 배열 (loadSupportTickets 참고)
    adminView:false, // 관리자(role==='ADMIN')만 "전체 문의" 화면으로 전환 가능
    adminTickets:[], // 전체 사용자 문의 목록 (loadAllSupportTickets 참고)
  },
  confirm: null,
  publicProfileModal: {open:false, loading:false, data:null}, // 랭킹 단상 아바타 클릭 시 (ranking.js openPublicProfile 참고)
  findIdModal: {open:false, result:null},
  findPwModal: {open:false, done:false},
  rankFilter: {city:null, gu:null, dong:null},
  exRankFilter: {city:null, gu:null, dong:null, ex:null},
  // 랭킹 탭에서 서버로부터 실제로 받아온 데이터를 담아두는 캐시 (loadRegionRanking 등 참고)
  rank: {region:[], exercise:[], crew:[]},
};

