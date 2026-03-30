<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { db } from '$lib/firebase';
  import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
  import { goto } from '$app/navigation';

  let classInfo = null;
  let isLoading = true;
  let isSubmitting = false;

  let name = "";
  let phone = "";

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

        // If already full, redirect to waitlist
        if ((data.students?.length || 0) >= 3) {
          alert("이 강의는 이미 정원이 찼습니다. 대기자 명단으로 안내합니다.");
          goto(`/waitlist/${classId}`);
        }
      }
    } catch (e) {
      console.error("Error fetching class details:", e);
    } finally {
      isLoading = false;
    }
  });

  function formatDate(dt) {
    if (!dt) return "";
    return dt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) + " (" + dt.toLocaleDateString("ko-KR", { weekday: "short" }) + ")";
  }

  function formatTime(dt) {
    if (!dt) return "";
    return dt.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  async function submitForm(e) {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    try {
      const docRef = doc(db, "guitarClass", classId);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();
      const currentStudents = data.students || [];

      if (currentStudents.length >= 3) {
        alert("죄송합니다. 그 사이에 신청이 마감되었습니다.");
        goto("/");
        return;
      }

      await updateDoc(docRef, {
        students: arrayUnion({
          id: Math.random().toString(36).substring(2, 9),
          name,
          phone,
          enrolledAt: new Date().toISOString()
        })
      });

      goto(`/confirmation/${classId}?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`);
    } catch (e) {
      console.error(e);
      alert("신청 중 오류가 발생했습니다: " + e.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>강의 신청 - 에디토리얼 루시어</title>
</svelte:head>

{#if isLoading}
  <div class="flex justify-center items-center h-[50vh]">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
{:else if classInfo}
  <!-- Hero Section / Editorial Header -->
  <section class="mb-10">
    <span class="text-secondary font-label text-[0.75rem] font-bold uppercase tracking-[0.2em] mb-2 block">신청서</span>
    <h2 class="text-4xl md:text-5xl font-headline font-extrabold text-primary leading-tight mb-4 tracking-tight">강의 신청</h2>
    <p class="text-on-surface-variant body-lg leading-relaxed max-w-md">저희 공방의 워크숍에 자리를 확보하세요. 개인별 숙련도를 높이기 위해 각 세션은 4명으로 제한됩니다.</p>
  </section>

  <!-- Selection Context Card -->
  <div class="bg-surface-container-low rounded-xl p-6 mb-10 relative overflow-hidden flex flex-col md:flex-row gap-6 items-start border-none">
    <div class="w-full md:w-32 h-32 rounded-lg bg-surface-container-highest flex-shrink-0 overflow-hidden">
      <img alt="기타 넥을 다듬는 전문가의 손" class="w-full h-full object-cover" src={classInfo.image || "/title.jpg"}/>
    </div>
    <div class="flex-grow">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-tertiary text-sm">event</span>
        <span class="text-on-surface-variant font-label text-sm font-semibold">{formatDate(classInfo.datetime)}, {formatTime(classInfo.datetime)}</span>
      </div>
      <h3 class="text-xl font-headline font-bold text-on-surface mb-1">{classInfo.title}</h3>
      <p class="text-on-surface-variant text-sm mb-4">3시간 세션</p>
      <div class="inline-flex items-center px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold uppercase tracking-wide">
        남은 자리
      </div>
    </div>
  </div>

  <!-- Aesthetic Floating Element -->
  <div class="fixed -right-8 -bottom-8 opacity-10 pointer-events-none z-[-1]">
    <span class="material-symbols-outlined text-[120px]" style="font-size: 120px;">handyman</span>
  </div>

  <!-- Form Section -->
  <form on:submit={submitForm} class="space-y-8 relative z-10">
    <div class="space-y-6">
      <!-- Name Field -->
      <div class="group">
        <label class="block font-label text-[0.75rem] font-bold text-on-surface-variant uppercase tracking-widest mb-3 ml-1" for="full_name">성함</label>
        <div class="relative">
          <input 
            required 
            bind:value={name}
            class="w-full bg-surface-container-lowest border-none rounded-xl px-5 py-4 text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/20 transition-all shadow-sm focus:outline-none" 
            id="full_name" 
            name="full_name" 
            placeholder="이름을 입력하세요" 
            type="text"
          />
        </div>
      </div>
      <!-- Phone Field -->
      <div class="group">
        <label class="block font-label text-[0.75rem] font-bold text-on-surface-variant uppercase tracking-widest mb-3 ml-1" for="phone">연락처</label>
        <div class="relative">
          <input 
            required 
            bind:value={phone}
            class="w-full bg-surface-container-lowest border-none rounded-xl px-5 py-4 text-on-surface placeholder:text-outline/50 focus:ring-2 focus:ring-primary/20 transition-all shadow-sm focus:outline-none" 
            id="phone" 
            name="phone" 
            placeholder="010-0000-0000" 
            type="tel"
          />
        </div>
      </div>
    </div>

    <!-- Policy & Tonal Content -->
    <div class="bg-surface-container-low p-5 rounded-xl border-none">
      <div class="flex gap-4">
        <span class="material-symbols-outlined text-primary shrink-0">info</span>
        <p class="text-xs text-on-surface-variant leading-relaxed">
          신청 시 스튜디오 정책에 동의하는 것으로 간주됩니다. 예약 취소는 워크숍 시작 48시간 전까지 가능하며, 이 경우 공방 적립금으로 반환됩니다.
        </p>
      </div>
    </div>

    <!-- Primary Action -->
    <button class="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-lg py-5 rounded-xl shadow-[0_24px_32px_rgba(48,20,0,0.06)] active:scale-[0.98] transition-all flex items-center justify-center gap-3" type="submit">
      신청 완료
      <span class="material-symbols-outlined">arrow_forward</span>
    </button>
    <!-- Secondary Action -->
    <button class="w-full text-on-surface-variant font-label font-bold text-sm uppercase tracking-widest py-2 hover:opacity-70 transition-opacity" type="button" on:click={() => history.back()}>
      취소
    </button>
  </form>
{:else}
  <div class="text-center py-20">
    <h1 class="text-2xl font-bold mb-4">강의 정보를 찾을 수 없습니다.</h1>
    <a href="/" class="text-primary hover:underline">메인으로 돌아가기</a>
  </div>
{/if}

<!-- Floating Background Textures (Subtle) -->
<div class="fixed top-0 left-0 w-full h-full -z-20 pointer-events-none overflow-hidden opacity-20">
  <div class="absolute top-[10%] -left-[5%] w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
  <div class="absolute bottom-[20%] -right-[10%] w-96 h-96 bg-secondary/20 rounded-full blur-3xl"></div>
</div>
