<script>
  import { onMount } from "svelte";
  import { db } from "$lib/firebase";
  import { 
    collection, 
    getDoc,
    getDocs,
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy,
    where,
    Timestamp,
    arrayRemove,
    runTransaction 
  } from "firebase/firestore";
  import { showAlert, showConfirm } from "$lib/dialogStore";

  let classes = [];
  let isLoading = true;
  let isSubmitting = false;

  console.log("Admin page script initialized");

  // Form State
  let editingId = null;
  let form = {
    title: "",
    datetime: "",
    image: "/title.jpg",
    students: []
  };

  onMount(fetchClasses);

  async function fetchClasses() {
    isLoading = true;
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, "guitarClass"), 
        where("datetime", ">=", now),
        orderBy("datetime", "asc")
      );
      const querySnapshot = await getDocs(q);
      classes = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let dtString = "";
        if (data.datetime?.toDate) {
          const d = data.datetime.toDate();
          const offset = d.getTimezoneOffset() * 60000;
          dtString = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        }
        return {
          id: doc.id,
          ...data,
          datetime: dtString
        };
      });
    } catch (e) {
      console.error(e);
      alert("데이터를 불러오는 중 오류 발생");
    } finally {
      isLoading = false;
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    isSubmitting = true;
    try {
      const payload = {
        title: form.title || "",
        image: form.image || "/title.jpg",
        students: form.students || [],
        datetime: Timestamp.fromDate(new Date(form.datetime))
      };

      if (editingId) {
        await updateDoc(doc(db, "guitarClass", editingId), payload);
        await showAlert("수정 완료");
      } else {
        await addDoc(collection(db, "guitarClass"), payload);
        await showAlert("추가 완료");
      }
      resetForm();
      await fetchClasses();
    } catch (e) {
      console.error(e);
      await showAlert("작업 중 오류 발생: " + e.message);
    } finally {
      isSubmitting = false;
    }
  }

  function editClass(cls) {
    editingId = cls.id;
    form = { 
      title: cls.title || "", 
      datetime: cls.datetime || "", 
      image: cls.image || "/title.jpg", // Fallback for missing image field
      students: cls.students || [] 
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteClass(id) {
    if (!(await showConfirm("정말로 이 강의를 삭제하시겠습니까?"))) return;
    try {
      await deleteDoc(doc(db, "guitarClass", id));
      await fetchClasses();
      await showAlert("삭제되었습니다.");
    } catch (e) {
      console.error(e);
      await showAlert("삭제 실패");
    }
  }

  async function removeStudent(classId, student) {
    if (!(await showConfirm(`${student.name}님을 예약 명단에서 제외하시겠습니까?\n(제외 시 대기자가 있으면 자동으로 승급됩니다)`))) return;

    try {
      const docRef = doc(db, "guitarClass", classId);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        let students = data.students || [];
        let waitlist = data.waitlist || [];

        // 1. Remove targeted student
        students = students.filter(s => {
          if (student.id && s.id) return s.id !== student.id;
          const sPhone = s.phone || s.phoneNumber;
          const targetPhone = student.phone || student.phoneNumber;
          return !(s.name === student.name && sPhone === targetPhone);
        });

        // 2. Automated promotion from waitlist
        if (waitlist.length > 0) {
          const nextInQueue = waitlist.shift();
          students.push({
            ...nextInQueue,
            enrolledAt: new Date().toISOString(),
            status: "PROMOTED_BY_ADMIN"
          });
        }

        transaction.update(docRef, { students, waitlist });
      });

      await fetchClasses();
      await showAlert("처리가 완료되었습니다.");
    } catch (e) {
      console.error(e);
      await showAlert("오류 발생: " + e.message);
    }
  }

  async function removeWaitlistEntry(classId, waitEntry) {
    if (!(await showConfirm(`${waitEntry.name}님을 대기 명단에서 삭제하시겠습니까?`))) return;

    try {
      const docRef = doc(db, "guitarClass", classId);
      await updateDoc(docRef, {
        waitlist: arrayRemove(waitEntry)
      });
      await fetchClasses();
      await showAlert("삭제되었습니다.");
    } catch (e) {
      console.error(e);
      await showAlert("삭제 중 오류 발생");
    }
  }

  function resetForm() {
    editingId = null;
    form = {
      title: "",
      datetime: "",
      image: "/title.jpg",
      students: []
    };
  }

  function formatApiDate(dt) {
    if (!dt) return "";
    const month = dt.getMonth() + 1;
    const date = dt.getDate();
    let hour = dt.getHours();
    const ampm = hour >= 12 ? "저녁" : "오전";
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${month}월${date}일 ${ampm}${hour}시`;
  }

  async function sendClassWideNotification(endpoint, cls) {
    const students = cls.students || [];
    if (students.length === 0) {
      await showAlert("대상 인원이 없습니다.");
      return;
    }

    const typeName = {
      sendClassConfirmation: "수업 확정",
      sendClassChange: "수업 변경",
      sendClassNotification: "공지 알림",
    }[endpoint];

    if (
      !(await showConfirm(
        `[${cls.title}] 수업의 모든 참여자(${students.length}명)에게 ${typeName}을(를) 발송하시겠습니까?`,
      ))
    )
      return;

    try {
      const dt = new Date(cls.datetime);
      const classDate = formatApiDate(dt);

      const promises = students.map((student) => {
        const phone = (student.phone || student.phoneNumber || "").replace(
          /[^0-9]/g,
          "",
        );
        const payload = {
          to: phone,
          className: cls.title,
          classDate: classDate,
          userName: student.name,
        };

        return fetch(`https://musclecat.co.kr/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      });

      await Promise.all(promises);
      await showAlert("모든 알림 발송이 요청되었습니다.");
    } catch (e) {
      console.error(e);
      await showAlert("발송 중 오류가 발생했습니다.");
    }
  }
</script>

<div class="max-w-6xl mx-auto p-6 md:p-10">
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
    <h1 class="text-4xl font-headline font-bold text-primary">강의 관리 시스템</h1>
    <a href="/" class="text-secondary font-bold hover:underline flex items-center gap-1">
      <span class="material-symbols-outlined text-sm">arrow_back</span>
      사용자 페이지로 이동
    </a>
  </div>

  <!-- Form Section -->
  <div class="bg-surface-container-low rounded-2xl p-8 mb-12 shadow-sm border border-outline-variant/10">
    <h2 class="text-2xl font-bold text-on-surface mb-6">
      {editingId ? "강의 수정" : "새 강의 추가"}
    </h2>
    <form onsubmit={handleSubmit} class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-2">
        <label for="class-title" class="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">강의명</label>
        <input 
          id="class-title"
          bind:value={form.title} 
          required 
          class="w-full bg-surface-container-lowest rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary transition-all outline-none" 
          placeholder="예: 핑거스타일 기초"
        />
      </div>
      <div class="space-y-2">
        <label for="class-datetime" class="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">일시</label>
        <input 
          id="class-datetime"
          type="datetime-local" 
          bind:value={form.datetime} 
          required 
          class="w-full bg-surface-container-lowest rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary transition-all outline-none"
        />
      </div>
      <div class="md:col-span-2 pt-4 flex gap-4">
        <button 
          type="submit" 
          disabled={isSubmitting}
          class="flex-grow btn-primary-gradient text-on-primary py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all hover:scale-101 active:scale-98"
        >
          {isSubmitting ? "저장 중..." : (editingId ? "저장하기" : "강의 등록")}
        </button>
        {#if editingId}
          <button 
            onclick={resetForm}
            class="px-8 bg-surface-container-highest text-on-surface-variant rounded-xl font-bold"
          >
            취소
          </button>
        {/if}
      </div>
    </form>
  </div>

  <!-- List Section -->
  <div class="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10">
    <table class="w-full text-left">
      <thead class="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-widest font-bold">
        <tr>
          <th class="px-6 py-4">강의명 / 일시</th>
          <th class="px-6 py-4">상태 / 인원</th>
          <th class="px-6 py-4 text-right">관리</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-outline-variant/10">
        {#if isLoading}
          <tr><td colspan="4" class="px-6 py-20 text-center text-on-surface-variant opacity-60">데이터를 불러오는 중...</td></tr>
        {:else if classes.length === 0}
          <tr><td colspan="4" class="px-6 py-20 text-center text-on-surface-variant opacity-60">등록된 강의가 없습니다.</td></tr>
        {:else}
          {#each classes as cls}
            {@const isFull = (cls.students?.length || 0) >= 3}
            <tr class="hover:bg-surface-container-low transition-colors group">
              <td class="px-6 py-5">
                <div class="flex items-center gap-3">
                  <div>
                    <p class="font-bold text-on-surface">{cls.title}</p>
                    <p class="text-xs text-on-surface-variant">{cls.datetime.replace('T', ' ')}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-5">
                <div class="flex flex-col">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="w-1.5 h-1.5 rounded-full {isFull ? 'bg-error' : 'bg-primary'}"></span>
                    <p class="text-sm font-bold {isFull ? 'text-error' : 'text-primary'}">
                      {isFull ? '신청 마감' : '신청 중'}
                    </p>
                  </div>
                  <p class="text-xs text-on-surface-variant font-medium">{cls.students?.length || 0} / 3명 예약됨</p>
                </div>
              </td>
              <td class="px-6 py-5 text-right">
                <div class="flex justify-end gap-2">
                  <button 
                    onclick={() => editClass(cls)}
                    class="p-2 hover:bg-secondary/10 text-secondary rounded-lg transition-colors"
                    title="수정"
                  >
                    <span class="material-symbols-outlined">edit</span>
                  </button>
                  <button 
                    onclick={() => deleteClass(cls.id)}
                    class="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                    title="삭제"
                  >
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </td>
            </tr>
            {#if (cls.students && cls.students.length > 0) || (cls.waitlist && cls.waitlist.length > 0)}
              <tr
                class="bg-surface-container-lowest/40 border-b border-outline-variant/5"
              >
                <td colspan="3" class="px-8 py-6">
                  <div class="flex flex-col gap-6">
                    {#if cls.students && cls.students.length > 0}
                      <div>
                        <div
                          class="flex items-center justify-between mb-4 bg-surface-container-high/20 p-4 rounded-2xl border border-outline-variant/10"
                        >
                          <p
                            class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 opacity-60"
                          >
                            <span class="material-symbols-outlined text-[14px]"
                              >groups</span
                            >
                            예약 확정 명단 ({cls.students.length})
                          </p>

                          <div class="flex items-center gap-2">
                            <span
                              class="text-[10px] font-bold text-on-surface-variant/40 mr-1"
                              >전체 알림 발송:</span
                            >
                            <div class="flex items-center gap-1">
                              <button
                                onclick={() =>
                                  sendClassWideNotification(
                                    "sendClassConfirmation",
                                    cls,
                                  )}
                                class="text-[9px] font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-all"
                                >확정</button
                              >
                              <button
                                onclick={() =>
                                  sendClassWideNotification(
                                    "sendClassChange",
                                    cls,
                                  )}
                                class="text-[9px] font-bold px-3 py-1.5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary hover:text-on-primary transition-all"
                                >변경</button
                              >
                              <button
                                onclick={() =>
                                  sendClassWideNotification(
                                    "sendClassNotification",
                                    cls,
                                  )}
                                class="text-[9px] font-bold px-3 py-1.5 rounded-full bg-on-surface-variant/10 text-on-surface-variant hover:bg-on-surface-variant hover:text-on-surface transition-all"
                                >알림</button
                              >
                            </div>
                          </div>
                        </div>

                        <div class="flex flex-wrap gap-2">
                          {#each cls.students as student}
                            <div
                              class="bg-surface-container-high/60 px-4 py-2.5 rounded-xl border border-outline-variant/10 flex items-center justify-between gap-4 group/item"
                            >
                              <div class="flex items-center gap-3">
                                <span class="font-bold text-sm text-on-surface"
                                  >{student.name}</span
                                >
                                <span
                                  class="text-[11px] text-on-surface-variant font-medium tracking-tight bg-surface-container-highest/60 px-2 py-0.5 rounded-md"
                                  >{student.phone ||
                                    student.phoneNumber ||
                                    "-"}</span
                                >
                              </div>

                              <button
                                onclick={() => removeStudent(cls.id, student)}
                                class="p-1.5 hover:bg-error/10 text-error rounded-lg opacity-60 hover:opacity-100 transition-all"
                                title="신청 취소 처리"
                              >
                                <span
                                  class="material-symbols-outlined text-[16px]"
                                  >close</span
                                >
                              </button>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    {#if cls.waitlist && cls.waitlist.length > 0}
                      <div>
                        <p
                          class="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5"
                        >
                          <span class="material-symbols-outlined text-[14px]"
                            >hourglass_empty</span
                          >
                          대기자 명단 ({cls.waitlist.length})
                        </p>
                        <div class="flex flex-wrap gap-2">
                          {#each cls.waitlist as wait}
                            <div
                              class="bg-secondary/5 px-4 py-2.5 rounded-xl border border-secondary/10 flex items-center justify-between gap-4 group/item"
                            >
                              <div class="flex items-center gap-3">
                                <span class="font-bold text-sm text-secondary"
                                  >{wait.name}</span
                                >
                                <span
                                  class="text-[11px] text-secondary/60 font-medium tracking-tight bg-secondary/5 px-2 py-0.5 rounded-md"
                                  >{wait.phone || "-"}</span
                                >
                              </div>
                              <button
                                onclick={() =>
                                  removeWaitlistEntry(cls.id, wait)}
                                class="p-1.5 hover:bg-error/10 text-error rounded-lg opacity-40 hover:opacity-100 transition-all"
                                title="대기 취소 처리"
                              >
                                <span class="material-symbols-outlined text-[16px]"
                                  >close</span
                                >
                              </button>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

<style>
  /* Material Date Picker Styling Hint */
  input[type="datetime-local"]::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.6;
    filter: invert(0.2);
  }
</style>
