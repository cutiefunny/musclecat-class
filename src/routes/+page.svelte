<script>
  import { onDestroy, onMount } from "svelte";
  import { db } from "$lib/firebase";
  import {
    collection,
    query,
    orderBy,
    where,
    Timestamp,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    onSnapshot,
  } from "firebase/firestore";
  import { goto } from "$app/navigation";

  const NAVER_MAP_ID = import.meta.env.VITE_NAVER_MAPS_CLIENT_ID;

  let classes = [];
  let isLoading = true;
  let unsubscribe = null;
  let mapElement;
  let map;

  // Modal State
  let showModal = false;
  let showSuccessModal = false;
  let successInfo = null;
  let selectedClass = null;
  let name = "";
  let phone = "";
  let isSubmitting = false;
  let autoCloseTimer = null;

  onMount(() => {
    fetchClassesRealtime();
    if (window.naver && window.naver.maps) {
      initMap();
    }
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
  });

  function initMap() {
    const location = new window.naver.maps.LatLng(37.548486, 126.923292);
    map = new window.naver.maps.Map(mapElement, {
      center: location,
      zoom: 17,
    });
    new window.naver.maps.Marker({
      position: location,
      map: map,
      title: "근육고양이공작소",
    });
  }

  function fetchClassesRealtime() {
    isLoading = true;
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, "guitarClass"),
        where("datetime", ">=", now),
        orderBy("datetime", "asc"),
      );

      unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          classes = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            datetime: doc.data().datetime.toDate
              ? doc.data().datetime.toDate()
              : new Date(doc.data().datetime),
          }));
          isLoading = false;
        },
        (error) => {
          console.error("Error with snapshot:", error);
          isLoading = false;
        },
      );
    } catch (e) {
      console.error("Error setting up listener:", e);
      isLoading = false;
    }
  }

  const TOTAL_SLOTS = 3;

  function getSlotsLeft(cls) {
    return Math.max(0, TOTAL_SLOTS - (cls.students?.length || 0));
  }

  function openModal(cls) {
    selectedClass = cls;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedClass = null;
    name = "";
    phone = "";
  }

  function openSuccessModal(info) {
    successInfo = info;
    showSuccessModal = true;

    // Auto close after 30 seconds
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      closeSuccessModal();
    }, 30000);
  }

  function closeSuccessModal() {
    showSuccessModal = false;
    successInfo = null;
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
  }

  async function handleEnrollment() {
    if (isSubmitting) return;
    if (!name || !phone) {
      alert("이름과 전화번호를 입력해주세요.");
      return;
    }

    isSubmitting = true;
    try {
      const docRef = doc(db, "guitarClass", selectedClass.id);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();
      const currentStudents = data.students || [];

      // Real-time double check
      if (currentStudents.length >= TOTAL_SLOTS) {
        if (
          confirm(
            "죄송합니다. 그 사이에 예약이 마감되었습니다. 대신 대기자 명단에 등록하시겠습니까?",
          )
        ) {
          // Register as waitlist
          await updateDoc(docRef, {
            waitlist: arrayUnion({
              name,
              phone,
              registeredAt: new Date().toISOString(),
            }),
          });
          alert("대기자 명단에 등록되었습니다.");
          closeModal();
        } else {
          closeModal();
        }
        return;
      }

      // Proceed with enrollment
      await updateDoc(docRef, {
        students: arrayUnion({
          id: Math.random().toString(36).substring(2, 9),
          name,
          phone,
          enrolledAt: new Date().toISOString(),
        }),
      });

      const info = {
        title: selectedClass.title,
        date: formatDate(selectedClass.datetime),
        time: formatTime(selectedClass.datetime),
        place: "마포구 독막로79 근육고양이공작소",
      };

      closeModal();
      openSuccessModal(info);
    } catch (e) {
      console.error(e);
      alert("예약 중 오류가 발생했습니다.");
    } finally {
      isSubmitting = false;
    }
  }

  function formatDate(dt) {
    return (
      dt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) +
      " (" +
      dt.toLocaleDateString("ko-KR", { weekday: "short" }) +
      ")"
    );
  }

  function formatTime(dt) {
    let start = dt.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    let end = new Date(dt.getTime() + 60 * 60 * 1000).toLocaleTimeString(
      "ko-KR",
      { hour: "numeric", minute: "2-digit", hour12: true },
    );
    return start + " — " + end.split(" ")[1];
  }
</script>

<svelte:head>
  <title>찍먹 기타교실</title>
  <script
    type="text/javascript"
    src="https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId={NAVER_MAP_ID}"
  ></script>
</svelte:head>

<!-- Hero Section -->
<section class="relative mb-8 rounded-xl overflow-hidden">
  <img class="w-full h-full object-cover" alt="title" src="/title.jpg" />
</section>

<!-- Location Section -->
<section class="mb-12">
  <div class="flex items-center gap-2 mb-4 px-1">
    <span class="material-symbols-outlined text-secondary">location_on</span>
    <h3 class="text-xl font-headline font-bold text-primary">
      근육고양이공작소
    </h3>
    <span class="text-sm text-on-surface-variant ml-2 font-medium"
      >마포구 독막로 79 (상수동)</span
    >
  </div>
  <div
    bind:this={mapElement}
    class="w-full h-[300px] md:h-[400px] rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden"
  ></div>
</section>

<!-- Class Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  {#each classes as cls}
    {@const slotsLeft = getSlotsLeft(cls)}

    <div
      class="
      rounded-xl p-7 flex flex-col justify-between group transition-all duration-300 border
      {slotsLeft === 0
        ? 'bg-surface-dim/40 border-outline-variant/20 grayscale-[0.5]'
        : 'bg-surface-container-low hover:shadow-[0_8px_32px_rgba(48,20,0,0.06)] border-transparent hover:border-outline-variant/10'}
    "
    >
      <div>
        <h4
          class="font-headline text-2xl font-bold {slotsLeft === 0
            ? 'text-primary opacity-80'
            : 'text-primary'} mb-2"
        >
          {cls.title}
        </h4>
        <div class="space-y-3 mb-8">
          <div
            class="flex items-center text-on-surface-variant/{slotsLeft === 0
              ? '60'
              : '80'}"
          >
            <span class="font-body text-sm font-semibold"
              >{formatDate(cls.datetime)}</span
            >
          </div>
          <div
            class="flex items-center text-on-surface-variant/{slotsLeft === 0
              ? '60'
              : '80'}"
          >
            <span class="font-body text-sm font-semibold"
              >{formatTime(cls.datetime)}</span
            >
          </div>
          <div
            class="flex items-center text-on-surface-variant/{slotsLeft === 0
              ? '60'
              : '80'}"
          >
            <span class="font-body text-sm font-semibold"
              >총 정원 {TOTAL_SLOTS}석 중 {slotsLeft}자리 남음</span
            >
          </div>
        </div>
      </div>
      <button
        onclick={() => openModal(cls)}
        class="block text-center w-full py-4 rounded-xl font-headline font-bold tracking-wide {slotsLeft ===
        0
          ? 'bg-surface-container-highest text-on-surface-variant'
          : 'btn-primary-gradient text-on-primary'}"
      >
        {slotsLeft === 0 ? "대기자 등록" : "지금 예약하기"}
      </button>
    </div>
  {/each}
</div>

<!-- Modal Overlay -->
{#if showModal}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-on-surface/40 backdrop-blur-sm transition-opacity"
      onclick={closeModal}
    ></div>

    <!-- Modal Content -->
    <div
      class="relative w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-[0_32px_64px_-12px_rgba(48,20,0,0.12)] overflow-hidden animate-in fade-in zoom-in duration-300"
    >
      <div class="p-8 sm:p-10">
        <div class="flex justify-between items-start mb-8">
          <div>
            <span
              class="text-xs font-label font-bold text-secondary uppercase tracking-[0.2em] mb-2 block"
              >수업 예약</span
            >
            <h3 class="text-2xl font-headline font-bold text-primary">
              {selectedClass?.title}
            </h3>
            <p class="text-sm text-on-surface-variant mt-1">
              세션 시간: {formatTime(selectedClass?.datetime)}
            </p>
          </div>
          <button
            onclick={closeModal}
            class="p-2 hover:bg-surface-container-high rounded-full transition-colors"
          >
            <span class="material-symbols-outlined text-on-surface-variant"
              >close</span
            >
          </button>
        </div>

        <div class="space-y-6">
          <div class="space-y-2">
            <label
              for="name"
              class="block text-xs font-label font-bold text-on-surface-variant uppercase tracking-widest ml-1"
              >이름</label
            >
            <input
              id="name"
              type="text"
              bind:value={name}
              placeholder="본인의 이름을 입력해주세요"
              disabled={isSubmitting}
              class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>

          <div class="space-y-2">
            <label
              for="phone"
              class="block text-xs font-label font-bold text-on-surface-variant uppercase tracking-widest ml-1"
              >연락처</label
            >
            <input
              id="phone"
              type="tel"
              bind:value={phone}
              placeholder="010-0000-0000"
              disabled={isSubmitting}
              class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>

          <div class="bg-primary/5 p-4 rounded-xl flex gap-3">
            <span class="material-symbols-outlined text-primary text-sm"
              >info</span
            >
            <p class="text-[11px] text-on-surface-variant leading-relaxed">
              예약 확정 정보는 입력하신 연락처로 별도 안내 드립니다. 입력 정보를
              다시 한번 확인해주세요.
            </p>
          </div>
        </div>

        <div class="mt-10 flex flex-col gap-3">
          <button
            onclick={handleEnrollment}
            disabled={isSubmitting}
            class="w-full bg-primary text-on-primary font-headline font-bold py-5 rounded-2xl shadow-lg shadow-primary/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:scale-100"
          >
            {isSubmitting ? "처리 중..." : "예약 확정하기"}
            {#if !isSubmitting}
              <span class="material-symbols-outlined">send</span>
            {/if}
          </button>
          <button
            onclick={closeModal}
            disabled={isSubmitting}
            class="w-full py-2 text-xs font-label font-bold text-on-surface-variant uppercase tracking-widest hover:opacity-70 transition-opacity"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Success Modal -->
{#if showSuccessModal}
  <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
    <div
      class="absolute inset-0 bg-on-surface/20 backdrop-blur-[2px]"
      onclick={closeSuccessModal}
    ></div>

    <div
      class="relative w-full max-w-sm bg-surface-container-lowest rounded-3xl shadow-[0_32px_64px_-12px_rgba(48,20,0,0.15)] overflow-hidden animate-in fade-in zoom-in duration-300"
    >
      <div class="p-8 text-center">
        <div
          class="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <span class="material-symbols-outlined text-3xl">check_circle</span>
        </div>

        <h3 class="text-xl font-headline font-bold text-primary mb-2">
          예약이 완료되었습니다!
        </h3>
        <p class="text-xs text-on-surface-variant mb-8 px-4 leading-relaxed">
          입력하신 연락처로 <span class="text-secondary font-bold"
            >카카오톡 안내 메시지</span
          >가 발송될 예정입니다.
        </p>

        <div
          class="bg-surface-container-low rounded-2xl p-5 text-left space-y-3 mb-8 border border-outline-variant/10"
        >
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-sm mt-0.5"
              >music_note</span
            >
            <div>
              <p
                class="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter"
              >
                강의
              </p>
              <p class="text-sm font-bold text-on-surface">
                {successInfo?.title}
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-sm mt-0.5"
              >calendar_today</span
            >
            <div>
              <p
                class="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter"
              >
                일정
              </p>
              <p class="text-sm font-bold text-on-surface">
                {successInfo?.date}
                {successInfo?.time}
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-sm mt-0.5"
              >location_on</span
            >
            <div>
              <p
                class="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter"
              >
                장소
              </p>
              <p class="text-sm font-bold text-on-surface">
                {successInfo?.place}
              </p>
            </div>
          </div>
        </div>

        <button
          onclick={closeSuccessModal}
          class="w-full py-4 bg-surface-container-highest text-on-surface-variant font-headline font-bold rounded-xl hover:bg-surface-container-high transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Custom animation utilities for the modal */
  @keyframes zoom-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .animate-in {
    animation-fill-mode: both;
  }
  .zoom-in {
    animation-name: zoom-in;
  }
</style>
