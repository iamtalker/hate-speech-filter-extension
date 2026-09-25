// 기본 단어 목록
//
// 기본값은 일부러 작게 유지한다(개인 맞춤형 도구이기 때문). 더 넓은 목록은
// wordpacks/extended-word-pack.json(팝업의 "확장 단어 팩 설치")에 있고, 그 팩은
// 여기 있는 모든 단어를 포함하는 상위 집합이다.
//
// 설계 원칙:
// - groupTerms(집단 식별어: 지역명/성별/국적 등)는 그 자체로는 절대 차단하지 않는다.
//   단독으로 등장해도 정상적인 문장일 수 있기 때문이다. (예: "전라도 여행 다녀왔어요")
// - explicitSlurs(명백한 멸칭/합성 비하어)는 다른 용도로 쓰일 여지가 거의 없으므로
//   등장 즉시 차단 대상으로 판단한다.
// - ambiguousSlurs(다른 뜻으로도 쓰이는 단어, 예: "홍어"=생선)는 groupTerms와
//   같은 블록 안에 함께 등장할 때만 차단 대상으로 판단한다.
const HSF_DEFAULT_WORDLISTS = {
  region: {
    label: "지역차별",
    groupTerms: ["전라도", "전라도민", "호남", "경상도", "경상도민", "영남"],
    explicitSlurs: ["전라디언", "전라디안"],
    ambiguousSlurs: ["홍어", "과메기"]
  },
  gender: {
    label: "성차별",
    groupTerms: ["여성", "여자", "남성", "남자"],
    explicitSlurs: ["김치녀", "한남충", "보슬아치", "된장녀", "맘충"],
    ambiguousSlurs: []
  },
  nationality: {
    label: "인종·국적차별",
    groupTerms: ["중국인", "일본인", "조선족", "흑인"],
    explicitSlurs: ["짱깨", "쪽바리", "깜둥이"],
    ambiguousSlurs: ["짜장"]
  },
  disability: {
    label: "장애 비하",
    groupTerms: ["장애인", "장애우"],
    explicitSlurs: ["장애자", "애자"],
    ambiguousSlurs: ["병신"]
  }
};
