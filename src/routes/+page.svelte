<script>
  import { onMount } from "svelte";
  import { db } from "$lib/firebase";
  import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";

  let classes = [];
  let isLoading = true;

  onMount(async () => {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, "guitarClass"),
        where("datetime", ">=", now),
        orderBy("datetime", "asc"),
      );
      const querySnapshot = await getDocs(q);
      classes = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Firestore timestamps need to be converted to JS Dates
        datetime: doc.data().datetime.toDate
          ? doc.data().datetime.toDate()
          : new Date(doc.data().datetime),
      }));
    } catch (e) {
      console.error("Error fetching classes:", e);
    } finally {
      isLoading = false;
    }
  });

  const TOTAL_SLOTS = 3;

  function getSlotsLeft(cls) {
    return Math.max(0, TOTAL_SLOTS - (cls.students?.length || 0));
  }

  function getButtonStyles(cls) {
    if (getSlotsLeft(cls) === 0) {
      return "bg-surface-container-highest text-on-surface-variant";
    }
    return "btn-primary-gradient text-on-primary";
  }

  function getButtonText(cls) {
    if (getSlotsLeft(cls) === 0) {
      return "대기자 등록";
    }
    return "지금 예약하기";
  }

  function getButtonLink(cls) {
    if (getSlotsLeft(cls) === 0) {
      return `/waitlist/${cls.id}`;
    }
    return `/enrollment/${cls.id}`;
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
    let end = new Date(dt.getTime() + 90 * 60 * 1000).toLocaleTimeString(
      "ko-KR",
      { hour: "numeric", minute: "2-digit", hour12: true },
    );
    return start + " — " + end.split(" ")[1];
  }

  function getIconInfo(title) {
    const icons = {
      "핑거스타일 기초": {
        icon: "library_music",
        bg: "bg-secondary-container",
        text: "text-on-secondary-container",
      },
      "어쿠스틱 이론 I": {
        icon: "music_note",
        bg: "bg-tertiary-fixed",
        text: "text-on-tertiary-fixed",
      },
      "리듬 & 퍼커션": {
        icon: "lock_clock",
        bg: "bg-surface-container-highest",
        text: "text-on-surface-variant",
      },
    };
    return icons[title] || icons["핑거스타일 기초"];
  }
</script>

<svelte:head>
  <title>찍먹 기타교실</title>
</svelte:head>

<!-- Hero Section -->
<section class="relative mb-16 rounded-xl overflow-hidden">
  <img class="w-full h-full object-cover" alt="title" src="/title.jpg" />
</section>

<!-- Upcoming Classes Header -->
<div class="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
  <div>
    <span
      class="font-label text-secondary uppercase tracking-[0.2em] font-bold text-xs mb-2 block"
      >토요일 세션</span
    >
    <h3 class="font-headline text-3xl font-bold text-on-surface-variant">
      강의 현황
    </h3>
  </div>
</div>

<!-- Class Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  {#each classes as cls}
    {@const slotsLeft = getSlotsLeft(cls)}
    {@const iconInfo = getIconInfo(cls.title)}
    <div
      class="
      rounded-xl p-7 flex flex-col justify-between group transition-all duration-300 border
      {slotsLeft === 0
        ? 'bg-surface-dim/40 border-outline-variant/20 grayscale-[0.5]'
        : 'bg-surface-container-low hover:shadow-[0_8px_32px_rgba(48,20,0,0.06)] border-transparent hover:border-outline-variant/10'}
    "
    >
      <div>
        <div class="flex justify-between items-start mb-6">
          <div class="{iconInfo.bg} {iconInfo.text} p-3 rounded-xl">
            <span class="material-symbols-outlined block">{iconInfo.icon}</span>
          </div>
          <div class="flex flex-col items-end">
            <span
              class="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant opacity-60"
              >상태</span
            >
            <span
              class="font-bold text-sm {slotsLeft === 0
                ? 'text-on-surface-variant'
                : slotsLeft === 1
                  ? 'text-tertiary'
                  : slotsLeft === 2
                    ? 'text-primary'
                    : 'text-secondary'}"
            >
              {slotsLeft === 0 ? "신청 마감" : "신청 중"}
            </span>
          </div>
        </div>
        <h4
          class="font-headline text-2xl font-bold {slotsLeft === 0
            ? 'text-primary opacity-80'
            : 'text-primary'} mb-2"
        >
          {cls.title}
        </h4>
        <div class="space-y-3 mb-8">
          <div
            class="flex items-center gap-3 text-on-surface-variant/{slotsLeft ===
            0
              ? '60'
              : '80'}"
          >
            <span class="material-symbols-outlined text-lg">calendar_today</span
            >
            <span class="font-body text-sm font-semibold"
              >{formatDate(cls.datetime)}</span
            >
          </div>
          <div
            class="flex items-center gap-3 text-on-surface-variant/{slotsLeft ===
            0
              ? '60'
              : '80'}"
          >
            <span class="material-symbols-outlined text-lg">schedule</span>
            <span class="font-body text-sm font-semibold"
              >{formatTime(cls.datetime)}</span
            >
          </div>
          <div
            class="flex items-center gap-3 text-on-surface-variant/{slotsLeft ===
            0
              ? '60'
              : '80'}"
          >
            <span class="material-symbols-outlined text-lg">groups</span>
            <span class="font-body text-sm font-semibold"
              >총 정원 {TOTAL_SLOTS}석</span
            >
          </div>
        </div>
      </div>
      <a
        href={getButtonLink(cls)}
        class="block text-center w-full py-4 rounded-xl font-headline font-bold tracking-wide {getButtonStyles(
          cls,
        )}"
      >
        {getButtonText(cls)}
      </a>
    </div>
  {/each}
</div>
