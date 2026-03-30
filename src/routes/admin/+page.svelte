<script>
  import { onMount } from "svelte";
  import { db } from "$lib/firebase";
  import { 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy,
    where,
    Timestamp 
  } from "firebase/firestore";

  let classes = [];
  let isLoading = true;
  let isSubmitting = false;

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

  async function handleSubmit() {
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
        alert("수정 완료");
      } else {
        await addDoc(collection(db, "guitarClass"), payload);
        alert("추가 완료");
      }
      resetForm();
      await fetchClasses();
    } catch (e) {
      console.error(e);
      alert("작업 중 오류 발생: " + e.message);
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
    if (!confirm("정말로 이 강의를 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, "guitarClass", id));
      await fetchClasses();
      alert("삭제되었습니다.");
    } catch (e) {
      console.error(e);
      alert("삭제 실패");
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
    <form on:submit|preventDefault={handleSubmit} class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-2">
        <label class="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">강의명</label>
        <input 
          bind:value={form.title} 
          required 
          class="w-full bg-surface-container-lowest rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary transition-all outline-none" 
          placeholder="예: 핑거스타일 기초"
        />
      </div>
      <div class="space-y-2">
        <label class="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">일시</label>
        <input 
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
            type="button" 
            on:click={resetForm}
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
                <p class="font-bold text-on-surface">{cls.title}</p>
                <p class="text-xs text-on-surface-variant">{cls.datetime.replace('T', ' ')}</p>
              </td>
              <td class="px-6 py-5">
                <p class="text-sm font-semibold {isFull ? 'text-error' : 'text-primary'}">
                  {isFull ? '신청 마감' : '신청 중'}
                </p>
                <p class="text-xs text-on-surface-variant">{cls.students?.length || 0} / 3명 예약</p>
              </td>
              <td class="px-6 py-5 text-right">
                <div class="flex justify-end gap-2">
                  <button 
                    on:click={() => editClass(cls)}
                    class="p-2 hover:bg-secondary/10 text-secondary rounded-lg transition-colors"
                  >
                    <span class="material-symbols-outlined">edit</span>
                  </button>
                  <button 
                    on:click={() => deleteClass(cls.id)}
                    class="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                  >
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </td>
            </tr>
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
