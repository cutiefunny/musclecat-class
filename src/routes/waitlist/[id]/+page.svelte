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
    return dt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  }

  function formatTime(dt) {
    if (!dt) return "";
    return dt.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  function submitWaitlist(e) {
    e.preventDefault();
    alert('대기 명단에 등록되었습니다!');
    window.location.href = '/';
  }
</script>

<svelte:head>
  <title>대기 명단 - 에디토리얼 루시어</title>
</svelte:head>

{#if isLoading}
  <div class="flex justify-center items-center h-[50vh]">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
{:else if classInfo}
  <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start mb-24 max-w-5xl mx-auto">
    <div class="md:col-span-7 space-y-8">
      <header>
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full mb-4">
          <span class="material-symbols-outlined text-[18px]">group</span>
          <span class="text-[10px] font-bold uppercase tracking-wider font-label">정원 초과 (3/3)</span>
        </div>
        <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight text-on-background leading-tight">
          대기 명단 등록
        </h1>
        <p class="mt-6 text-lg text-on-surface-variant leading-relaxed font-body">
          현재 <span class="text-tertiary font-semibold">{classInfo.title}</span> 강의의 정원이 모두 찼습니다. 대기 명단에 등록하시면 공석이 생기거나 추가 세션이 개설될 때 가장 먼저 안내해 드립니다.
        </p>
      </header>

      <div class="relative rounded-xl overflow-hidden aspect-[16/9] shadow-lg group">
        <img alt="루시어 워크숍 전경" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="/title.jpg"/>
        <div class="absolute inset-0 bg-gradient-to-t from-on-background/60 to-transparent"></div>
        <div class="absolute bottom-6 left-6 right-6 flex justify-between items-end">
          <div class="text-white">
            <p class="font-label text-xs uppercase tracking-widest opacity-80 mb-1">강의 날짜</p>
            <h3 class="font-headline text-xl font-bold">{formatDate(classInfo.datetime)}</h3>
          </div>
          <div class="bg-surface/20 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20 text-white text-sm">
            대기 명단: 2명 신청 중
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <h2 class="text-xl font-bold text-on-surface-variant">운영 방식</h2>
        <div class="grid grid-cols-1 gap-4">
          <div class="flex gap-4 p-5 bg-surface-container-low rounded-xl items-start">
            <span class="material-symbols-outlined text-secondary">notification_important</span>
            <div>
              <h4 class="font-bold text-on-surface">우선 안내</h4>
              <p class="text-sm text-on-surface-variant leading-normal">공석이 생기면 대기 등록 순서대로 안내해 드립니다. 안내 후 4시간 이내에 확정해 주셔야 합니다.</p>
            </div>
          </div>
          <div class="flex gap-4 p-5 bg-surface-container-low rounded-xl items-start">
            <span class="material-symbols-outlined text-secondary">update</span>
            <div>
              <h4 class="font-bold text-on-surface">향후 우선권</h4>
              <p class="text-sm text-on-surface-variant leading-normal">대기 등록 회원에게는 다음 세션 예약 오픈 시 24시간 먼저 예약할 수 있는 권한을 드립니다.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <aside class="md:col-span-5 md:sticky md:top-28">
      <div class="bg-surface-container-lowest p-8 rounded-xl shadow-[0_24px_48px_rgba(48,20,0,0.06)] border border-outline-variant/10">
        <h3 class="text-2xl font-bold text-primary mb-6">대기 명단 합류</h3>
        <form on:submit={submitWaitlist} class="space-y-6">
          <div class="space-y-2">
            <label class="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider px-1">성함</label>
            <input required class="w-full bg-surface-container-low border-none rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-secondary transition-all outline-none" placeholder="홍길동" type="text"/>
          </div>
          <div class="space-y-2">
            <label class="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider px-1">휴대폰 번호</label>
            <input required class="w-full bg-surface-container-low border-none rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-secondary transition-all outline-none" placeholder="010-0000-0000" type="tel"/>
          </div>
          <div class="space-y-2">
            <label class="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider px-1">이메일 (선택 사항)</label>
            <input class="w-full bg-surface-container-low border-none rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-secondary transition-all outline-none" placeholder="example@email.com" type="email"/>
          </div>
          <div class="pt-4">
            <button class="w-full bg-gradient-to-r from-secondary to-[#4a8a87] text-white font-headline font-bold py-4 rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2" type="submit">
              <span class="material-symbols-outlined">how_to_reg</span>
              대기 명단 등록
            </button>
          </div>
          <p class="text-[10px] text-center text-on-surface-variant/60 font-body uppercase tracking-tighter">
            대기 등록에는 별도의 예약금이 필요하지 않습니다.
          </p>
        </form>
      </div>

      <div class="mt-8 p-6 bg-tertiary/5 rounded-xl flex items-center gap-4">
        <div class="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-tertiary">support_agent</span>
        </div>
        <div>
          <p class="text-sm font-bold text-tertiary">문의 사항이 있으신가요?</p>
          <p class="text-xs text-on-surface-variant">스튜디오 코디네이터에게 개인 맞춤 교육에 대해 문의하세요.</p>
        </div>
      </div>
    </aside>
  </div>
{:else}
  <div class="text-center py-20">
    <h1 class="text-2xl font-bold mb-4">강의 정보를 찾을 수 없습니다.</h1>
    <a href="/" class="text-primary hover:underline">메인으로 돌아가기</a>
  </div>
{/if}
