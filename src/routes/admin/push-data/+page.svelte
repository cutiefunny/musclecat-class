<script>
  import { db } from "$lib/firebase";
  import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

  let status = "진행률 대기 중...";
  let isProcessing = false;

  const mockData = [
    {
      title: "핑거스타일 기초",
      datetime: new Date("2026-10-14T15:00:00"),
      students: [{ name: "김철수", phoneNumber: "010-1111-2222" }],
      status: "신청 가능",
    },
    {
      title: "어쿠스틱 이론 I",
      datetime: new Date("2026-10-21T15:00:00"),
      students: [
        { name: "이영희", phoneNumber: "010-3333-4444" },
        { name: "박지성", phoneNumber: "010-5555-6666" },
      ],
      status: "신청 가능",
    },
    {
      title: "리듬 & 퍼커션",
      datetime: new Date("2026-10-28T15:00:00"),
      students: [
        { name: "정다은", phoneNumber: "010-7777-8888" },
        { name: "최유진", phoneNumber: "010-9999-0000" },
        { name: "윤하늘", phoneNumber: "010-1234-5678" },
      ],
      status: "강의 마감",
    },
  ];

  async function pushData() {
    isProcessing = true;
    status = "기존 데이터 삭제 중...";
    try {
      // 1. Clear existing data (optional, but good for idempotent testing)
      const querySnapshot = await getDocs(collection(db, "guitarClass"));
      for (const item of querySnapshot.docs) {
        await deleteDoc(doc(db, "guitarClass", item.id));
      }

      // 2. Push mock data
      status = "데이터 푸쉬 중...";
      for (const item of mockData) {
        await addDoc(collection(db, "guitarClass"), item);
      }
      status = "성공적으로 데이터를 푸쉬했습니다!";
    } catch (e) {
      console.error(e);
      status = "오류 발생: " + e.message;
    } finally {
      isProcessing = false;
    }
  }
</script>

<div class="p-10 bg-surface-container-low rounded-2xl max-w-xl mx-auto mt-20 text-center">
  <h1 class="text-3xl font-headline font-bold text-primary mb-6">데이터 마이그레이션</h1>
  <p class="text-on-surface-variant mb-8 leading-relaxed">
    현재의 Mock 데이터를 Firebase <strong>guitarClass</strong> 컬렉션으로 전송합니다. 기존 데이터가 있는 경우 모두 삭제되고 새로 생성됩니다.
  </p>
  
  <div class="mb-8 p-4 bg-surface-container-highest rounded-xl text-on-surface-variant font-mono text-sm">
    {status}
  </div>

  <button 
    on:click={pushData} 
    disabled={isProcessing}
    class="w-full btn-primary-gradient text-on-primary py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all active:scale-98"
  >
    {isProcessing ? "작업 중..." : "Firebase에 데이터 밀어넣기"}
  </button>
  
  <a href="/" class="block mt-6 text-sm text-secondary font-bold hover:underline">메인으로 돌아가기</a>
</div>
