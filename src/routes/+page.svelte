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
    arrayRemove,
    runTransaction,
    onSnapshot,
    addDoc,
    setDoc,
  } from "firebase/firestore";
  import { showAlert, showConfirm } from "$lib/dialogStore";

  const NAVER_MAP_ID = import.meta.env.VITE_NAVER_MAPS_CLIENT_ID;

  let classes = [];
  let myReservations = [];
  let isLoading = true;
  let unsubscribe = null;
  let mapElement;
  let map;
  let showMap = false;
  let isMapInitialized = false;

  // Modal & Dialog State
  let showModal = false;
  let showSuccessModal = false;
  let successInfo = null;
  let selectedClass = null;
  let deviceId = "";
  let name = "";
  let phone = "";
  let isSubmitting = false;
  let isFriendRegistration = false;
  let autoCloseTimer = null;
  let showChat = false;
  let chatMessages = [];
  let chatInput = "";
  let chatUnsubscribe = null;
  let inquiryUnsubscribe = null;
  let chatContainer;

  onMount(() => {
    // Identity & Auto-fill Logic
    deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId =
        "dev_" +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);
      localStorage.setItem("deviceId", deviceId);
    }

    fetchClassesRealtime();
    // Map will be initialized when first expanded
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    if (chatUnsubscribe) chatUnsubscribe();
    if (inquiryUnsubscribe) inquiryUnsubscribe();
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
  });

  function initMap() {
    const address = "서울특별시 마포구 독막로 79";

    // Using the Geocoder submodule included in the script
    window.naver.maps.Service.geocode(
      {
        query: address,
      },
      function (status, response) {
        if (status !== window.naver.maps.Service.Status.OK) {
          console.error("Geocoding failed, falling back to coordinates.");
          renderMap(new window.naver.maps.LatLng(37.548486, 126.923292));
          return;
        }

        const result = response.v2.addresses[0];
        const point = new window.naver.maps.LatLng(result.y, result.x);
        renderMap(point);
      },
    );
  }

  function renderMap(point) {
    if (!mapElement) return;
    map = new window.naver.maps.Map(mapElement, {
      center: point,
      zoom: 18, // Zoomed in 2x (from 17 to 18)
      scrollWheel: false,
    });

    new window.naver.maps.Marker({
      position: point,
      map: map,
      title: "근육고양이공작소",
      icon: {
        url: "/pin.png",
        scaledSize: new window.naver.maps.Size(40, 50),
        origin: new window.naver.maps.Point(0, 0),
        anchor: new window.naver.maps.Point(20, 40),
      },
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
          const allData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            datetime: doc.data().datetime.toDate
              ? doc.data().datetime.toDate()
              : new Date(doc.data().datetime),
          }));

          classes = allData;

          // Filter for my reservations (both enrolled and waitlisted)
          myReservations = allData
            .map((cls) => {
              const enrolledUser = (cls.students || []).find(
                (s) => s.deviceId === deviceId,
              );
              const waitlistedUser = (cls.waitlist || []).find(
                (w) => w.deviceId === deviceId,
              );

              if (enrolledUser) {
                return {
                  ...cls,
                  userStatus: "ENROLLED",
                  userEntry: enrolledUser,
                };
              } else if (waitlistedUser) {
                return {
                  ...cls,
                  userStatus: "WAITLIST",
                  userEntry: waitlistedUser,
                };
              }
              return null;
            })
            .filter((r) => r !== null);

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

  function openModal(cls, forFriend = false) {
    selectedClass = cls;
    isFriendRegistration = forFriend;

    if (forFriend) {
      name = "";
      phone = "";
    } else {
      // Identity & Auto-fill Logic
      const savedName = localStorage.getItem("userName");
      const savedPhone = localStorage.getItem("userPhone");
      if (savedName) name = savedName;
      if (savedPhone) phone = savedPhone;
    }

    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedClass = null;
    // Note: We no longer clear 'name' and 'phone' so they stay for auto-fill
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

  function formatApiDate(dt) {
    const month = dt.getMonth() + 1;
    const date = dt.getDate();
    let hour = dt.getHours();
    const ampm = hour >= 12 ? "저녁" : "오전";
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${month}월${date}일 ${ampm}${hour}시`;
  }

  async function callConfirmationApi(name, phone, className, datetime) {
    try {
      const classDate = formatApiDate(datetime);
      await fetch("https://musclecat.co.kr/sendClassConfirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone.replace(/[^0-9]/g, ""),
          className,
          classDate,
          userName: name,
        }),
      });
    } catch (e) {
      console.error("Failed to call confirmation API:", e);
    }
  }

  async function callWaitingApi(name, phone, className, datetime, waitingNo) {
    try {
      const classDate = formatApiDate(datetime);
      await fetch("https://musclecat.co.kr/sendClassWaiting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone.replace(/[^0-9]/g, ""),
          className,
          classDate,
          userName: name,
          waitingNo: String(waitingNo),
        }),
      });
    } catch (e) {
      console.error("Failed to call waiting API:", e);
    }
  }

  async function handleEnrollment() {
    if (isSubmitting) return;
    if (!name || !phone) {
      await showAlert("이름과 전화번호를 입력해주세요.");
      return;
    }

    // Save info to localStorage for future auto-fill (only if not friend registration)
    if (!isFriendRegistration) {
      localStorage.setItem("userName", name);
      localStorage.setItem("userPhone", phone);
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
          await showConfirm(
            "죄송합니다. 그 사이에 예약이 마감되었습니다.\n대신 대기자 명단에 등록하시겠습니까?",
          )
        ) {
          // Register as waitlist
          await updateDoc(docRef, {
            waitlist: arrayUnion({
              id: Math.random().toString(36).substring(2, 9),
              name,
              phone,
              deviceId,
              registeredAt: new Date().toISOString(),
            }),
          });

          // API Call
          const waitingNo = (data.waitlist || []).length + 1;
          callWaitingApi(
            name,
            phone,
            selectedClass.title,
            selectedClass.datetime,
            waitingNo,
          );

          // Admin notification
          fetch("https://musclecat.co.kr/sendClassChange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: "01083151379",
              className: selectedClass.title,
              guide: `새로운 수업 신청(대기)이 도착했습니다. ${name} ${phone}`,
            }),
          }).catch((e) => console.error("Admin notification failed:", e));

          await showAlert("대기자 명단에 등록되었습니다.");
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
          deviceId,
          enrolledAt: new Date().toISOString(),
        }),
      });

      // API Call
      callConfirmationApi(
        name,
        phone,
        selectedClass.title,
        selectedClass.datetime,
      );

      // Admin notification
      fetch("https://musclecat.co.kr/sendClassChange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "01083151379",
          className: selectedClass.title,
          guide: `새로운 수업 신청이 도착했습니다. ${name} ${phone}`,
        }),
      }).catch((e) => console.error("Admin notification failed:", e));

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
      await showAlert("예약 중 오류가 발생했습니다.");
    } finally {
      isSubmitting = false;
    }
  }

  async function handleCancel(res) {
    if (!(await showConfirm("정말 신청을 취소하시겠습니까?"))) return;

    let promotedUser = null;

    try {
      const docRef = doc(db, "guitarClass", res.id);

      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;

        const data = sfDoc.data();
        let students = data.students || [];
        let waitlist = data.waitlist || [];

        if (res.userStatus === "ENROLLED") {
          // 1. Remove the specifically canceling record from students
          students = students.filter((s) => s.id !== res.userEntry.id);

          // 2. If there's someone in the waitlist, promote them (FIFO)
          if (waitlist.length > 0) {
            promotedUser = waitlist.shift();
            students.push({
              ...promotedUser,
              enrolledAt: new Date().toISOString(),
              status: "PROMOTED",
            });
          }
        } else {
          // Simply remove the specific entry from waitlist
          waitlist = waitlist.filter((w) => w.id !== res.userEntry.id);
        }

        transaction.update(docRef, { students, waitlist });
      });

      if (promotedUser) {
        callConfirmationApi(
          promotedUser.name,
          promotedUser.phone,
          res.title,
          res.datetime,
        );
      }

      await showAlert("성공적으로 취소되었습니다.");
    } catch (e) {
      console.error("Cancel Error:", e);
      await showAlert("취소 처리 중 오류가 발생했습니다.");
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

  function scrollToReservation() {
    const target = document.getElementById("reservation-section");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }

  function toggleMap() {
    showMap = !showMap;
    if (showMap && !isMapInitialized && window.naver && window.naver.maps) {
      initMap();
      isMapInitialized = true;
    }
  }

  function toggleChat() {
    showChat = !showChat;
    if (showChat) {
      setTimeout(() => {
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 0);
      setupChatListener();
    } else {
      if (chatUnsubscribe) chatUnsubscribe();
    }
  }

  function setupChatListener() {
    if (chatUnsubscribe) chatUnsubscribe();
    if (inquiryUnsubscribe) inquiryUnsubscribe();

    // Listen to parent doc existence (for deletions)
    inquiryUnsubscribe = onSnapshot(doc(db, "inquiries", deviceId), (snapshot) => {
      if (!snapshot.exists()) {
        chatMessages = [];
      }
    });

    const q = query(
      collection(db, "inquiries", deviceId, "messages"),
      orderBy("timestamp", "asc"),
    );
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
      chatMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTimeout(() => {
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 0);
    });
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    chatInput = "";

    try {
      const docRef = doc(db, "inquiries", deviceId);
      const docSnap = await getDoc(docRef);
      const isNew = !docSnap.exists();

      await addDoc(collection(db, "inquiries", deviceId, "messages"), {
        text: msg,
        sender: "user",
        timestamp: Timestamp.now(),
      });
      await setDoc(
        docRef,
        {
          lastActivity: Timestamp.now(),
          lastMessage: msg,
          unreadByAdmin: true,
          status: "답변필요",
        },
        { merge: true },
      );

      if (isNew) {
        fetch("https://musclecat.co.kr/sendClassChange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: "01083151379",
            className: "기타수업",
            guide: "새로운 상담 요청이 도착했습니다.",
          }),
        }).catch((e) => console.error("Notification API failed:", e));
      }
    } catch (e) {
      console.error(e);
      showAlert("메시지 전송에 실패했습니다.");
    }
  }
</script>

<svelte:head>
  <title>찍먹 기타교실</title>
  <script
    type="text/javascript"
    src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId={NAVER_MAP_ID}&submodules=geocoder"
  ></script>
</svelte:head>

<!-- Hero Section -->
<button
  onclick={scrollToReservation}
  class="w-full relative mb-4 rounded-xl overflow-hidden cursor-pointer group block"
>
  <img
    class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
    alt="title"
    src="/title.jpg"
  />
  <div
    class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-5"
  >
    <div
      class="bg-surface-container-lowest/90 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform"
    >
      <span class="material-symbols-outlined text-primary">arrow_downward</span>
      <span class="text-sm font-headline font-bold text-primary">예약하기</span>
    </div>
  </div>
</button>

<!-- Location Section -->
<section class="mb-4">
  <button
    onclick={toggleMap}
    class="w-full flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-sm hover:bg-surface-container-high transition-all group"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary group-hover:bg-secondary/20 transition-colors"
      >
        <span class="material-symbols-outlined">location_on</span>
      </div>
      <div class="text-left">
        <h3 class="text-lg font-headline font-bold text-primary">
          근육고양이스튜디오
        </h3>
        <p class="text-sm text-on-surface-variant font-medium">
          상수역 1번 출구에서 도보 10초
        </p>
      </div>
    </div>
    <div
      class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-high transition-transform duration-300 {showMap
        ? 'rotate-180'
        : ''}"
    >
      <span class="material-symbols-outlined text-on-surface-variant"
        >expand_more</span
      >
    </div>
  </button>

  <div
    class="mt-4 {showMap
      ? 'block animate-in fade-in slide-in-from-top-4 duration-300'
      : 'hidden'}"
  >
    <div
      bind:this={mapElement}
      class="w-full aspect-[2/1] min-h-[250px] rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden"
    ></div>
  </div>
</section>

<!-- Class Grid -->
<div
  id="reservation-section"
  class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
>
  {#each classes as cls}
    {@const slotsLeft = getSlotsLeft(cls)}
    {@const enrolledUser = (cls.students || []).find(
      (s) => s.deviceId === deviceId,
    )}
    {@const waitlistedUser = (cls.waitlist || []).find(
      (w) => w.deviceId === deviceId,
    )}
    {@const isApplied = enrolledUser || waitlistedUser}

    <div
      class="
      rounded-xl p-7 flex flex-col justify-between group transition-all duration-300 border
      {slotsLeft === 0 && !isApplied
        ? 'bg-surface-dim/40 border-outline-variant/20 grayscale-[0.5]'
        : 'bg-surface-container-low hover:shadow-[0_8px_32px_rgba(48,20,0,0.06)] border-transparent hover:border-outline-variant/10'}
      {isApplied ? 'ring-2 ring-primary/20 border-primary/20' : ''}
    "
    >
      <div>
        <h4
          class="font-headline text-2xl font-bold {slotsLeft === 0 && !isApplied
            ? 'text-primary opacity-80'
            : 'text-primary'} mb-2"
        >
          {cls.title}
        </h4>
        <div class="space-y-2 mb-8">
          <div
            class="flex items-center gap-2 text-on-surface-variant/{slotsLeft ===
              0 && !isApplied
              ? '60'
              : '80'}"
          >
            <span class="font-body text-sm font-semibold"
              >{formatDate(cls.datetime)}</span
            >
            <span class="text-on-surface-variant/30">•</span>
            <span class="font-body text-sm font-semibold"
              >{formatTime(cls.datetime)}</span
            >
          </div>
          <div
            class="flex items-center {slotsLeft === 1
              ? 'text-error font-bold'
              : slotsLeft === 0
                ? 'text-on-surface-variant/40'
                : 'text-on-surface-variant/80'}"
          >
            <span class="font-body text-sm font-semibold"
              >총 정원 {TOTAL_SLOTS}석 중 {slotsLeft}자리 남음</span
            >
          </div>
        </div>
      </div>

      {#if isApplied}
        <div class="mt-auto space-y-3">
          <div class="space-y-2 max-h-[120px] overflow-y-auto pr-1">
            {#each (cls.students || []).filter((s) => s.deviceId === deviceId) as myEntry}
              <div
                class="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20"
              >
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-lg"
                    >check_circle</span
                  >
                  <span class="text-xs font-headline font-bold text-on-surface"
                    >{myEntry.name}</span
                  >
                </div>
                <button
                  onclick={() =>
                    handleCancel({
                      ...cls,
                      userStatus: "ENROLLED",
                      userEntry: myEntry,
                    })}
                  class="text-[11px] font-bold text-error/60 hover:text-error transition-colors"
                  >취소</button
                >
              </div>
            {/each}

            {#each (cls.waitlist || []).filter((w) => w.deviceId === deviceId) as myWait}
              <div
                class="flex items-center justify-between p-3 bg-secondary/5 rounded-xl border border-secondary/20"
              >
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-lg"
                    >hourglass_top</span
                  >
                  <span class="text-xs font-headline font-bold text-on-surface"
                    >{myWait.name}</span
                  >
                </div>
                <button
                  onclick={() =>
                    handleCancel({
                      ...cls,
                      userStatus: "WAITLIST",
                      userEntry: myWait,
                    })}
                  class="text-[11px] font-bold text-error/60 hover:text-error transition-colors"
                  >취소</button
                >
              </div>
            {/each}
          </div>

          {#if slotsLeft > 0}
            <button
              onclick={() => openModal(cls, true)}
              class="block text-center w-full py-4 rounded-xl font-headline font-bold tracking-wide btn-primary-gradient text-on-primary shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            >
              친구도 예약해주기
            </button>
          {/if}
        </div>
      {:else}
        <button
          onclick={() => openModal(cls)}
          class="block text-center w-full py-4 rounded-xl font-headline font-bold tracking-wide {slotsLeft ===
          0
            ? 'bg-surface-container-highest text-on-surface-variant'
            : 'btn-primary-gradient text-on-primary'}"
        >
          {slotsLeft === 0 ? "대기자 등록" : "예약하기"}
        </button>
      {/if}
    </div>
  {/each}
</div>

<!-- Inquiry Section -->
<section class="mt-4 mb-4 flex flex-col items-center w-full">
  <button
    onclick={toggleChat}
    class="inline-flex items-center gap-2 px-8 py-4 bg-primary text-on-primary font-headline font-bold rounded-2xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.03] active:scale-[0.98]"
  >
    <span class="material-symbols-outlined text-lg"
      >{showChat ? "close" : "chat_bubble"}</span
    >
    {showChat ? "채팅창 닫기" : "실시간 문의하기"}
  </button>

  {#if showChat}
    <div
      class="mt-4 w-full max-w-xl bg-surface-container-low rounded-3xl overflow-hidden border border-outline-variant/10 flex flex-col h-[400px] text-left animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <!-- Chat Header -->
      <div
        class="p-4 bg-surface-container border-b border-outline-variant/10 flex items-center gap-3"
      >
        <div
          class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"
        >
          <span class="material-symbols-outlined text-sm">pets</span>
        </div>
        <div>
          <p class="text-xs font-bold text-primary">냐사장</p>
          <p class="text-[10px] text-on-surface-variant">
            보통 1시간 이내에 답변을 드려요
          </p>
        </div>
      </div>
      <!-- Message Area -->
      <div
        bind:this={chatContainer}
        class="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-dim/10"
      >
        {#if chatMessages.length === 0}
          <div
            class="h-full flex flex-col items-center justify-center opacity-30 text-center"
          >
            <span class="material-symbols-outlined text-3xl mb-2"
              >auto_awesome</span
            >
            <p class="text-[11px]">
              무료 기타 체험, 원데이 클래스 등<br />궁금한 내용을 남겨주세요!
            </p>
          </div>
        {/if}
        {#each chatMessages as msg}
          <div
            class="flex {msg.sender === 'user'
              ? 'justify-end'
              : 'justify-start'}"
          >
            <div
              class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm {msg.sender ===
              'user'
                ? 'bg-primary text-on-primary rounded-tr-none'
                : 'bg-surface-container-high text-on-surface rounded-tl-none'}"
            >
              {msg.text}
            </div>
          </div>
        {/each}
      </div>

      <!-- Input Area -->
      <div class="p-4 bg-surface-container border-t border-outline-variant/10">
        <div class="relative">
          <input
            type="text"
            bind:value={chatInput}
            onkeydown={(e) => e.key === "Enter" && sendChatMessage()}
            placeholder="문의 내용을 입력하세요..."
            class="w-full bg-surface-container-low border-none rounded-2xl px-5 py-4 pr-12 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
          <button
            onclick={sendChatMessage}
            class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            <span class="material-symbols-outlined text-lg">send</span>
          </button>
        </div>
      </div>
    </div>
  {/if}
</section>

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
