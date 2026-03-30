<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { db } from '$lib/firebase';
  import { doc, getDoc } from 'firebase/firestore';

  let classInfo = null;
  let isLoading = true;

  $: classId = $page.params.id;

  onMount(async () => {
    try {
      const docRef = doc(db, "guitarClass", classId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        classInfo = {
          id: docSnap.id,
          ...data,
          datetime: data.datetime.toDate ? data.datetime.toDate() : new Date(data.datetime)
        };
      }
    } catch (e) {
      console.error("Error fetching class details:", e);
    } finally {
      isLoading = false;
    }
  });

  function formatDate(dt) {
    if (!dt) return "";
    return dt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  }

  function formatTime(dt) {
    if (!dt) return "";
    return dt.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
  }
</script>

<svelte:head>
  <title>예약 완료 - 에디토리얼 루시어</title>
</svelte:head>

{#if isLoading}
  <div class="flex justify-center items-center h-[50vh]">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
{:else if classInfo}
  <div class="max-w-2xl w-full flex flex-col items-center mt-12 mb-24">
    <!-- Success Visual Anchor -->
    <div class="relative mb-12 flex justify-center items-center">
      <div class="absolute w-48 h-48 bg-secondary-container rounded-full opacity-20 blur-3xl"></div>
      <div class="z-10 bg-surface-container-lowest p-8 rounded-xl shadow-[0_24px_48px_rgba(48,20,0,0.06)] flex items-center justify-center transform rotate-3">
        <span class="material-symbols-outlined text-secondary text-6xl" style="font-variation-settings: 'FILL' 1;">check_circle</span>
      </div>
      <div class="absolute -right-8 top-0 z-0 bg-tertiary-fixed rounded-xl p-4 transform -rotate-6 hidden md:block">
        <span class="material-symbols-outlined text-on-tertiary-fixed text-3xl">music_note</span>
      </div>
    </div>

    <!-- Header Section -->
    <div class="text-center mb-10">
      <h1 class="font-headline font-extrabold text-4xl md:text-5xl text-primary tracking-tight mb-4">
        예약이 완료되었습니다
      </h1>
      <p class="text-on-surface-variant text-lg md:text-xl max-w-md mx-auto">
        공방에 귀하의 자리가 마련되었습니다. 세션 상세 정보를 기기로 전송해 드렸습니다.
      </p>
    </div>

    <!-- Confirmation Bento Card -->
    <div class="w-full grid grid-cols-1 md:grid-cols-12 gap-4 mb-12">
      <!-- Class Info -->
      <div class="md:col-span-8 bg-surface-container-low p-7 rounded-xl flex flex-col justify-between">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[10px] font-label font-bold text-primary uppercase tracking-widest block mb-1">워크숍 강의</span>
            <h2 class="text-2xl font-headline font-bold text-on-surface">{classInfo.title}</h2>
          </div>
        </div>
        <div class="flex flex-wrap gap-6">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">calendar_today</span>
            <div>
              <p class="text-[10px] font-label font-bold text-on-surface-variant uppercase">날짜</p>
              <p class="font-bold text-on-surface">{formatDate(classInfo.datetime)}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">schedule</span>
            <div>
              <p class="text-[10px] font-label font-bold text-on-surface-variant uppercase">시간</p>
              <p class="font-bold text-on-surface">{formatTime(classInfo.datetime)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- User Details -->
      <div class="md:col-span-4 bg-primary text-on-primary p-7 rounded-xl flex flex-col justify-between">
        <div class="mb-8">
          <span class="font-label text-on-primary-container font-bold uppercase tracking-widest text-[10px] block mb-2">참석자</span>
          <p class="font-headline font-bold text-xl mb-1">홍길동</p>
          <p class="text-on-primary-container text-sm">•••• •••• 8812</p>
        </div>
        <div class="bg-primary-container/30 p-4 rounded-lg">
          <p class="text-[10px] font-label font-bold uppercase mb-1">상태</p>
          <p class="text-sm font-semibold flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
            신청 완료
          </p>
        </div>
      </div>

      <!-- Location/Map Mini-View -->
      <div class="md:col-span-12 relative h-48 rounded-xl overflow-hidden group">
        <img class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="모던하고 미니멀한 음악 스튜디오" src="/title.jpg"/>
        <div class="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
        <div class="absolute bottom-6 left-6 flex items-center gap-3 text-on-primary">
          <div class="bg-surface-container-lowest text-primary p-2 rounded-lg">
            <span class="material-symbols-outlined">location_on</span>
          </div>
          <div>
            <p class="font-bold">에디토리얼 스튜디오</p>
            <p class="text-xs text-on-primary-container">서울특별시 강남구 논현동</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Cluster -->
    <div class="w-full flex flex-col sm:flex-row gap-4 items-center justify-center">
      <a class="w-full sm:w-auto px-8 py-4 rounded-xl text-on-surface font-headline font-bold text-center hover:bg-surface-container-high transition-all active:scale-95 duration-200" href="/">
        메인으로 돌아가기
      </a>
    </div>

    <!-- Help Footer -->
    <div class="mt-16 text-center">
      <p class="text-on-surface-variant text-sm flex items-center justify-center gap-2">
        일정 변경이 필요하신가요? 
        <a class="text-secondary font-bold hover:underline" href="#">마스터 루시어에게 문의하기</a>
      </p>
    </div>
  </div>
{:else}
  <div class="max-w-2xl w-full flex flex-col items-center mt-12 mb-24 text-center">
    <h1 class="text-2xl font-bold mb-4 text-primary">예약 정보를 찾을 수 없습니다.</h1>
    <a href="/" class="text-secondary font-bold hover:underline">메인으로 돌아가기</a>
  </div>
{/if}

<!-- Visual Texture Element (Asymmetric overlap) -->
<div class="fixed bottom-0 right-0 pointer-events-none opacity-10 translate-x-1/4 translate-y-1/4 select-none z-[-1]">
  <span class="material-symbols-outlined text-[400px] text-primary" style="font-variation-settings: 'wght' 100;">graphic_eq</span>
</div>
