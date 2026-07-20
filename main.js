(function () {
  const STORAGE_KEY = "autoPartsStoreDB";

  function getDB() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return {
      customers: [],
      suppliers: [],
      inventory: [],
      sales: [],
      purchases: [],
      payments: [],
      supplierPayments: [],
      salesReturns: [],
      purchaseReturns: [],
      withdrawals: [],
      nextIds: {
        customer: 1,
        supplier: 1,
        inventory: 1,
        sale: 1,
        purchase: 1,
        payment: 1,
        supplierPayment: 1,
        salesReturn: 1,
        purchaseReturn: 1,
        withdrawal: 1,
      },
    };
  }

  function saveDB(db) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
  let db = getDB();

  function generateId(type) {
    if (!db.nextIds[type]) db.nextIds[type] = 1;
    const id = db.nextIds[type];
    db.nextIds[type] = id + 1;
    saveDB(db);
    return id;
  }

  function formatCurrency(amount) {
    const num = parseFloat(amount || 0);
    return num.toLocaleString("ar-EG") + " ل.س";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getCustomerById(id) {
    return db.customers.find((c) => c.id === id);
  }
  function getSupplierById(id) {
    return db.suppliers.find((s) => s.id === id);
  }
  function getInventoryById(id) {
    return db.inventory.find((i) => i.id === id);
  }

  function updateCustomerBalance(customerId) {
    const customer = getCustomerById(customerId);
    if (!customer) return;
    const salesTotal = db.sales
      .filter((s) => s.customerId === customerId)
      .reduce((sum, s) => sum + (s.remaining || 0), 0);
    const returnsTotal = db.salesReturns
      .filter((r) => r.customerId === customerId)
      .reduce((sum, r) => {
        const sale = db.sales.find((s) => s.id === r.saleId);
        if (sale) return sum + r.quantity * sale.unitPrice;
        return sum;
      }, 0);
    const paymentsTotal = db.payments
      .filter((p) => p.customerId === customerId)
      .reduce((sum, p) => sum + p.amount, 0);
    customer.balance = salesTotal - returnsTotal - paymentsTotal;
    saveDB(db);
  }

  function updateSupplierBalance(supplierId) {
    const supplier = getSupplierById(supplierId);
    if (!supplier) return;
    const purchasesTotal = db.purchases
      .filter((p) => p.supplierId === supplierId)
      .reduce((sum, p) => sum + (p.remaining || 0), 0);
    const returnsTotal = db.purchaseReturns
      .filter((r) => r.supplierId === supplierId)
      .reduce((sum, r) => {
        const purchase = db.purchases.find((p) => p.id === r.purchaseId);
        if (purchase) return sum + r.quantity * purchase.unitPrice;
        return sum;
      }, 0);
    const paymentsTotal = db.supplierPayments
      .filter((sp) => sp.supplierId === supplierId)
      .reduce((sum, sp) => sum + sp.amount, 0);
    supplier.balance = purchasesTotal - returnsTotal - paymentsTotal;
    saveDB(db);
  }

  function distributeCustomerPayment(customerId, amount) {
    const unpaid = db.sales
      .filter((s) => s.customerId === customerId && s.remaining > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let remaining = amount;
    for (const sale of unpaid) {
      if (remaining <= 0) break;
      const deduction = Math.min(sale.remaining, remaining);
      sale.remaining -= deduction;
      sale.paid += deduction;
      remaining -= deduction;
    }
  }

  function distributeSupplierPayment(supplierId, amount) {
    const unpaid = db.purchases
      .filter((p) => p.supplierId === supplierId && p.remaining > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let remaining = amount;
    for (const purchase of unpaid) {
      if (remaining <= 0) break;
      const deduction = Math.min(purchase.remaining, remaining);
      purchase.remaining -= deduction;
      purchase.paid += deduction;
      remaining -= deduction;
    }
  }

  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ============ البحث المباشر (Searchable Select) ============
  function initSearchableSelect(inputId, options, onSelect) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // إنشاء wrapper و dropdown
    const wrapper = document.createElement("div");
    wrapper.className = "searchable-select";
    wrapper.style.position = "relative";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement("div");
    dropdown.className = "dropdown-list";
    wrapper.appendChild(dropdown);

    let selectedValue = null;
    let selectedText = "";

    function filterOptions(search) {
      const s = (search || "").toLowerCase();
      return options.filter(
        (opt) =>
          opt.text.toLowerCase().includes(s) ||
          opt.value.toLowerCase().includes(s),
      );
    }

    function renderDropdown(items) {
      if (items.length === 0) {
        dropdown.innerHTML =
          '<div class="dropdown-item" style="color:#999;">لا توجد نتائج</div>';
      } else {
        dropdown.innerHTML = items
          .map(
            (opt) =>
              `<div class="dropdown-item" data-value="${opt.value}" data-text="${opt.text}">${opt.text}</div>`,
          )
          .join("");
      }
      dropdown.classList.add("active");
    }

    input.addEventListener("focus", () => {
      const filtered = filterOptions(input.value);
      renderDropdown(filtered);
    });

    input.addEventListener("input", () => {
      selectedValue = null;
      selectedText = "";
      const filtered = filterOptions(input.value);
      renderDropdown(filtered);
    });

    dropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdown-item");
      if (item && item.dataset.value) {
        selectedValue = item.dataset.value;
        selectedText = item.dataset.text;
        input.value = selectedText;
        dropdown.classList.remove("active");
        if (onSelect) onSelect(selectedValue, selectedText);
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.remove("active");
        // إذا لم يتم اختيار شيء، أعد النص الأصلي
        if (!selectedValue && input.value.trim() && options.length > 0) {
          // يمكن إضافة خيار جديد
        }
      }
    });

    return {
      getValue: () => selectedValue,
      getText: () => selectedText,
      setValue: (val, text) => {
        selectedValue = val;
        selectedText = text;
        input.value = text;
      },
      clear: () => {
        selectedValue = null;
        selectedText = "";
        input.value = "";
      },
    };
  }

  // ============ التنقل ============
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a");
  const pages = document.querySelectorAll(".page");
  const sidebar = document.getElementById("sidebar");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");

  function navigateTo(pageName) {
    pages.forEach((p) => p.classList.remove("active"));
    sidebarLinks.forEach((l) => l.classList.remove("active"));
    const page = document.getElementById("page-" + pageName);
    if (page) page.classList.add("active");
    const link = document.querySelector(
      `.sidebar-nav a[data-page="${pageName}"]`,
    );
    if (link) link.classList.add("active");
    if (window.innerWidth <= 768) sidebar.classList.remove("open");
    refreshPage(pageName);
  }

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", () =>
      navigateTo(link.getAttribute("data-page")),
    );
  });

  mobileMenuBtn.addEventListener("click", () =>
    sidebar.classList.toggle("open"),
  );

  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      !sidebar.contains(e.target) &&
      e.target !== mobileMenuBtn &&
      !mobileMenuBtn.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  function refreshPage(pageName) {
    switch (pageName) {
      case "dashboard":
        renderDashboard();
        break;
      case "customers":
        renderCustomers();
        break;
      case "suppliers":
        renderSuppliers();
        break;
      case "inventory":
        renderInventory();
        break;
      case "sales":
        renderSales();
        break;
      case "purchases":
        renderPurchases();
        break;
      case "payments":
        renderPayments();
        break;
      case "supplier_payments":
        renderSupplierPayments();
        break;
      case "withdrawals":
        renderWithdrawals();
        break;
      case "reports":
        renderReports();
        break;
    }
  }

  // ============ لوحة التحكم ============
  function renderDashboard() {
    const totalCustomers = db.customers.length;
    const totalSuppliers = db.suppliers.length;
    const totalInventory = db.inventory.length;
    const totalQty = db.inventory.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalCustDebts = db.customers.reduce(
      (s, c) => s + Math.max(0, c.balance || 0),
      0,
    );
    const totalSuppDebts = db.suppliers.reduce(
      (s, sup) => s + Math.max(0, sup.balance || 0),
      0,
    );
    const lowStock = db.inventory.filter(
      (i) => i.quantity <= (i.minAlert || 5),
    ).length;
    const totalWithdrawals = db.withdrawals.reduce((s, w) => s + w.amount, 0);

    document.getElementById("dashboardStats").innerHTML = `
            <div class="stat-card"><div class="stat-icon blue">👥</div><div class="stat-info"><h3>العملاء</h3><div class="value">${totalCustomers}</div></div></div>
            <div class="stat-card"><div class="stat-icon green">🏭</div><div class="stat-info"><h3>الموردين</h3><div class="value">${totalSuppliers}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-info"><h3>القطع</h3><div class="value">${totalInventory}</div><small>الكمية: ${totalQty}</small></div></div>
            <div class="stat-card"><div class="stat-icon red">💸</div><div class="stat-info"><h3>ديون العملاء</h3><div class="value">${formatCurrency(totalCustDebts)}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange">🏦</div><div class="stat-info"><h3>ديون للموردين</h3><div class="value">${formatCurrency(totalSuppDebts)}</div></div></div>
            <div class="stat-card"><div class="stat-icon red">💸</div><div class="stat-info"><h3>إجمالي السحوبات</h3><div class="value">${formatCurrency(totalWithdrawals)}</div></div></div>
        `;

    const recent = [
      ...db.sales.map((s) => ({ ...s, type: "sale" })),
      ...db.purchases.map((p) => ({ ...p, type: "purchase" })),
      ...db.withdrawals.map((w) => ({ ...w, type: "withdrawal" })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
    const div = document.getElementById("recentActivity");
    if (recent.length === 0)
      div.innerHTML = '<p class="empty-state">📭 لا توجد عمليات</p>';
    else {
      let h = '<ul style="list-style:none;padding:0;">';
      recent.forEach((op) => {
        if (op.type === "sale") {
          const c = getCustomerById(op.customerId);
          h += `<li style="padding:6px 0;border-bottom:1px solid var(--border);">🛒 بيع لـ ${c ? c.name : "؟"} - ${formatCurrency(op.total)} | ${formatDate(op.date)}</li>`;
        } else if (op.type === "purchase") {
          const s = getSupplierById(op.supplierId);
          h += `<li style="padding:6px 0;border-bottom:1px solid var(--border);">📥 شراء من ${s ? s.name : "؟"} - ${formatCurrency(op.total)} | ${formatDate(op.date)}</li>`;
        } else if (op.type === "withdrawal") {
          h += `<li style="padding:6px 0;border-bottom:1px solid var(--border);">💸 سحب: ${op.personName} - ${formatCurrency(op.amount)} | ${formatDate(op.date)}</li>`;
        }
      });
      h += "</ul>";
      div.innerHTML = h;
    }
  }

  // ============ العملاء ============
  function renderCustomers() {
    const search = (
      document.getElementById("customerSearch")?.value || ""
    ).toLowerCase();
    let filtered = db.customers.filter(
      (c) => c.name.toLowerCase().includes(search) || c.phone.includes(search),
    );
    const tbody = document.getElementById("customersTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7"><div class="empty-state">👤 لا يوجد عملاء</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((c) => {
        const bal = c.balance || 0;
        let badge =
          bal > 0
            ? `<span class="badge badge-danger">مدين ${formatCurrency(bal)}</span>`
            : bal < 0
              ? `<span class="badge badge-success">دائن ${formatCurrency(Math.abs(bal))}</span>`
              : '<span class="badge badge-info">متوازن</span>';
        return `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.phone || "-"}</td><td>${c.address || "-"}</td><td>${formatCurrency(bal)}</td><td>${badge}</td>
            <td><button class="btn btn-outline btn-xs" onclick="editCustomer(${c.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteCustomer(${c.id})">🗑️</button></td></tr>`;
      })
      .join("");
  }

  window.openCustomerModal = function (customer = null) {
    const isEdit = customer !== null;
    const html = `
        <div class="modal-overlay" id="custModal">
            <div class="modal"><div class="modal-header"><h3>${isEdit ? "✏️ تعديل" : "➕ إضافة"} عميل</h3><button class="modal-close" onclick="closeModal('custModal')">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label>الاسم *</label><input id="custName" value="${isEdit ? customer.name : ""}"></div>
                <div class="form-row"><div class="form-group"><label>الهاتف</label><input id="custPhone" value="${isEdit ? customer.phone || "" : ""}"></div>
                <div class="form-group"><label>العنوان</label><input id="custAddress" value="${isEdit ? customer.address || "" : ""}"></div></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('custModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="saveCustomer(${isEdit ? customer.id : "null"})">💾 حفظ</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
  };
  window.editCustomer = function (id) {
    const c = getCustomerById(id);
    if (c) openCustomerModal(c);
  };
  window.saveCustomer = function (id) {
    const name = document.getElementById("custName")?.value.trim();
    if (!name) {
      showToast("الاسم مطلوب", "error");
      return;
    }
    const phone = document.getElementById("custPhone")?.value.trim() || "";
    const address = document.getElementById("custAddress")?.value.trim() || "";
    if (id) {
      const c = getCustomerById(id);
      if (c) {
        c.name = name;
        c.phone = phone;
        c.address = address;
      }
    } else {
      db.customers.push({
        id: generateId("customer"),
        name,
        phone,
        address,
        balance: 0,
        createdAt: new Date().toISOString(),
      });
    }
    saveDB(db);
    closeModal("custModal");
    renderCustomers();
    renderDashboard();
    showToast(id ? "تم التحديث ✅" : "تم الإضافة ✅");
  };
  window.deleteCustomer = function (id) {
    const c = getCustomerById(id);
    if (!c) return;
    if (db.sales.some((s) => s.customerId === id)) {
      showToast("لا يمكن حذف عميل له فواتير", "error");
      return;
    }
    if (!confirm(`حذف ${c.name}؟`)) return;
    db.customers = db.customers.filter((x) => x.id !== id);
    db.payments = db.payments.filter((p) => p.customerId !== id);
    db.salesReturns = db.salesReturns.filter((r) => r.customerId !== id);
    saveDB(db);
    renderCustomers();
    renderDashboard();
    showToast("تم الحذف 🗑️");
  };

  // ============ الموردين ============
  function renderSuppliers() {
    const search = (
      document.getElementById("supplierSearch")?.value || ""
    ).toLowerCase();
    let filtered = db.suppliers.filter(
      (s) => s.name.toLowerCase().includes(search) || s.phone.includes(search),
    );
    const tbody = document.getElementById("suppliersTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7"><div class="empty-state">🏭 لا يوجد موردين</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((s) => {
        const bal = s.balance || 0;
        let badge =
          bal > 0
            ? `<span class="badge badge-danger">علينا ${formatCurrency(bal)}</span>`
            : bal < 0
              ? `<span class="badge badge-success">لنا ${formatCurrency(Math.abs(bal))}</span>`
              : '<span class="badge badge-info">متوازن</span>';
        return `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.phone || "-"}</td><td>${s.address || "-"}</td><td>${formatCurrency(bal)}</td><td>${badge}</td>
            <td><button class="btn btn-outline btn-xs" onclick="editSupplier(${s.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteSupplier(${s.id})">🗑️</button></td></tr>`;
      })
      .join("");
  }

  window.openSupplierModal = function (supplier = null) {
    const isEdit = supplier !== null;
    const html = `
        <div class="modal-overlay" id="supModal">
            <div class="modal"><div class="modal-header"><h3>${isEdit ? "✏️ تعديل" : "➕ إضافة"} مورد</h3><button class="modal-close" onclick="closeModal('supModal')">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label>الاسم *</label><input id="supName" value="${isEdit ? supplier.name : ""}"></div>
                <div class="form-row"><div class="form-group"><label>الهاتف</label><input id="supPhone" value="${isEdit ? supplier.phone || "" : ""}"></div>
                <div class="form-group"><label>العنوان</label><input id="supAddress" value="${isEdit ? supplier.address || "" : ""}"></div></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('supModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="saveSupplier(${isEdit ? supplier.id : "null"})">💾 حفظ</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
  };
  window.editSupplier = function (id) {
    const s = getSupplierById(id);
    if (s) openSupplierModal(s);
  };
  window.saveSupplier = function (id) {
    const name = document.getElementById("supName")?.value.trim();
    if (!name) {
      showToast("الاسم مطلوب", "error");
      return;
    }
    const phone = document.getElementById("supPhone")?.value.trim() || "";
    const address = document.getElementById("supAddress")?.value.trim() || "";
    if (id) {
      const s = getSupplierById(id);
      if (s) {
        s.name = name;
        s.phone = phone;
        s.address = address;
      }
    } else {
      db.suppliers.push({
        id: generateId("supplier"),
        name,
        phone,
        address,
        balance: 0,
        createdAt: new Date().toISOString(),
      });
    }
    saveDB(db);
    closeModal("supModal");
    renderSuppliers();
    renderDashboard();
    showToast(id ? "تم التحديث ✅" : "تم الإضافة ✅");
  };
  window.deleteSupplier = function (id) {
    const s = getSupplierById(id);
    if (!s) return;
    if (db.purchases.some((p) => p.supplierId === id)) {
      showToast("لا يمكن حذف مورد له فواتير", "error");
      return;
    }
    if (!confirm(`حذف ${s.name}؟`)) return;
    db.suppliers = db.suppliers.filter((x) => x.id !== id);
    db.supplierPayments = db.supplierPayments.filter(
      (p) => p.supplierId !== id,
    );
    db.purchaseReturns = db.purchaseReturns.filter((r) => r.supplierId !== id);
    saveDB(db);
    renderSuppliers();
    renderDashboard();
    showToast("تم الحذف 🗑️");
  };

  // ============ المستودع (بدون سعر البيع) ============
  function renderInventory() {
    const search = (
      document.getElementById("inventorySearch")?.value || ""
    ).toLowerCase();
    const cat = document.getElementById("categoryFilter")?.value || "";
    let filtered = db.inventory;
    if (search)
      filtered = filtered.filter(
        (i) =>
          i.partName.toLowerCase().includes(search) ||
          (i.partNumber || "").toLowerCase().includes(search),
      );
    if (cat) filtered = filtered.filter((i) => i.category === cat);
    const tbody = document.getElementById("inventoryTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10"><div class="empty-state">📦 لا توجد قطع</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((i) => {
        const low = i.quantity <= (i.minAlert || 5);
        const img = i.image
          ? `<img src="${i.image}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">`
          : "🚫";
        return `<tr style="${low ? "background:#fff5f5" : ""}">
                <td>${i.id}</td><td>${img}</td><td><strong>${i.partName}</strong></td><td>${i.partNumber || "-"}</td>
                <td><span class="badge badge-info">${i.category || "أخرى"}</span></td><td>${i.quantity}</td>
                <td>${formatCurrency(i.purchasePrice)}</td><td>${i.supplier || "-"}</td>
                <td>${low ? '<span class="badge badge-danger">⚠️ منخفض</span>' : '<span class="badge badge-success">✅ جيد</span>'}</td>
                <td><button class="btn btn-outline btn-xs" onclick="editInventory(${i.id})">✏️</button>
                <button class="btn btn-danger btn-xs" onclick="deleteInventory(${i.id})">🗑️</button></td></tr>`;
      })
      .join("");
  }

  window.openInventoryModal = function (item = null) {
    const isEdit = item !== null;
    const cats = [
      "محرك",
      "ناقل حركة",
      "فرامل",
      "تعليق",
      "كهرباء",
      "تكييف",
      "إطارات",
      "بطاريات",
      "فلاتر",
      "زيوت",
      "أخرى",
    ];
    const catOpts = cats
      .map(
        (c) =>
          `<option value="${c}" ${isEdit && item.category === c ? "selected" : ""}>${c}</option>`,
      )
      .join("");
    const html = `
        <div class="modal-overlay" id="invModal">
            <div class="modal"><div class="modal-header"><h3>${isEdit ? "✏️ تعديل" : "➕ إضافة"} قطعة</h3><button class="modal-close" onclick="closeModal('invModal')">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label>صورة</label><input type="file" id="partImage" accept="image/*" onchange="previewPartImage()">
                <img id="partImagePreview" src="${isEdit && item.image ? item.image : ""}" style="max-width:100px;max-height:100px;margin-top:5px;display:${isEdit && item.image ? "block" : "none"};"></div>
                <div class="form-group"><label>الاسم *</label><input id="partName" value="${isEdit ? item.partName : ""}"></div>
                <div class="form-row"><div class="form-group"><label>رقم القطعة</label><input id="partNumber" value="${isEdit ? item.partNumber || "" : ""}"></div>
                <div class="form-group"><label>الفئة</label><select id="partCategory">${catOpts}</select></div></div>
                <div class="form-row"><div class="form-group"><label>الكمية *</label><input type="number" id="partQty" value="${isEdit ? item.quantity : 0}" min="0"></div>
                <div class="form-group"><label>حد التنبيه</label><input type="number" id="partMinAlert" value="${isEdit ? item.minAlert || 5 : 5}" min="1"></div></div>
                <div class="form-group"><label>سعر الشراء *</label><input type="number" id="partPurchasePrice" value="${isEdit ? item.purchasePrice || 0 : 0}" step="0.01"></div>
                <div class="form-group"><label>المورد</label><input id="partSupplier" value="${isEdit ? item.supplier || "" : ""}"></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('invModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="saveInventory(${isEdit ? item.id : "null"})">💾 حفظ</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
  };
  window.previewPartImage = function () {
    const file = document.getElementById("partImage")?.files[0];
    const preview = document.getElementById("partImagePreview");
    if (file && preview) {
      const r = new FileReader();
      r.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = "block";
      };
      r.readAsDataURL(file);
    }
  };
  window.editInventory = function (id) {
    const i = getInventoryById(id);
    if (i) openInventoryModal(i);
  };
  window.saveInventory = function (id) {
    const partName = document.getElementById("partName")?.value.trim();
    if (!partName) {
      showToast("الاسم مطلوب", "error");
      return;
    }
    const partNumber =
      document.getElementById("partNumber")?.value.trim() || "";
    const category = document.getElementById("partCategory")?.value || "أخرى";
    const quantity = parseInt(document.getElementById("partQty")?.value) || 0;
    const minAlert =
      parseInt(document.getElementById("partMinAlert")?.value) || 5;
    const purchasePrice =
      parseFloat(document.getElementById("partPurchasePrice")?.value) || 0;
    const supplier =
      document.getElementById("partSupplier")?.value.trim() || "";
    const imageInput = document.getElementById("partImage");
    let image = id ? getInventoryById(id)?.image || null : null;
    const finalize = (img) => {
      const data = {
        partName,
        partNumber,
        category,
        quantity,
        minAlert,
        purchasePrice,
        supplier,
        image: img,
      };
      if (id) {
        const item = getInventoryById(id);
        if (item) Object.assign(item, data);
      } else {
        db.inventory.push({
          id: generateId("inventory"),
          ...data,
          createdAt: new Date().toISOString(),
        });
      }
      saveDB(db);
      closeModal("invModal");
      renderInventory();
      renderDashboard();
      showToast(id ? "تم التحديث ✅" : "تم الإضافة ✅");
    };
    if (imageInput && imageInput.files[0]) {
      const r = new FileReader();
      r.onload = (e) => finalize(e.target.result);
      r.readAsDataURL(imageInput.files[0]);
    } else {
      finalize(image);
    }
  };
  window.deleteInventory = function (id) {
    const item = getInventoryById(id);
    if (!item) return;
    if (
      db.sales.some((s) => s.inventoryId === id) ||
      db.purchases.some((p) => p.inventoryId === id)
    ) {
      showToast("لا يمكن حذف قطعة مرتبطة بفواتير", "error");
      return;
    }
    if (!confirm(`حذف ${item.partName}؟`)) return;
    db.inventory = db.inventory.filter((x) => x.id !== id);
    saveDB(db);
    renderInventory();
    renderDashboard();
    showToast("تم الحذف 🗑️");
  };

  // ============ المبيعات (مع سعر البيع اليدوي) ============
  function renderSales() {
    const search = (
      document.getElementById("saleSearch")?.value || ""
    ).toLowerCase();
    let filtered = db.sales.filter((s) => {
      const c = getCustomerById(s.customerId);
      const inv = getInventoryById(s.inventoryId);
      return (
        (c && c.name.toLowerCase().includes(search)) ||
        (inv && inv.partName.toLowerCase().includes(search))
      );
    });
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById("salesTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="11"><div class="empty-state">🛒 لا توجد مبيعات</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((s) => {
        const c = getCustomerById(s.customerId);
        const inv = getInventoryById(s.inventoryId);
        const returns = db.salesReturns
          .filter((r) => r.saleId === s.id)
          .reduce((sum, r) => sum + r.quantity, 0);
        const netQty = s.quantity - returns;
        const status =
          s.remaining <= 0
            ? '<span class="badge badge-success">✅ مسدد</span>'
            : '<span class="badge badge-danger">📌 دين</span>';
        return `<tr>
                <td>${s.id}</td><td>${formatDate(s.date)}</td><td>${c ? c.name : "?"}</td><td>${inv ? inv.partName : "?"}</td>
                <td>${netQty}${returns > 0 ? ` <small style="color:var(--danger)">(مرتجع ${returns})</small>` : ""}</td>
                <td>${formatCurrency(s.unitPrice)}</td><td>${formatCurrency(s.total)}</td><td>${formatCurrency(s.paid)}</td>
                <td>${formatCurrency(s.remaining)}</td><td>${status}</td>
                <td><button class="btn btn-danger btn-xs" onclick="deleteSale(${s.id})">🗑️</button>
                <button class="btn btn-xs" onclick="openSalesReturnModal(${s.id})" style="background:var(--warning);color:#fff;">↩️ مرتجع</button></td></tr>`;
      })
      .join("");
  }

  window.openSaleModal = function () {
    const custOpts = db.customers.map((c) => ({
      value: String(c.id),
      text: `${c.name} - ${c.phone || ""}`,
    }));
    const invOpts = db.inventory
      .filter((i) => i.quantity > 0)
      .map((i) => ({
        value: String(i.id),
        text: `${i.partName} (${i.partNumber || ""}) - متاح:${i.quantity}`,
      }));
    if (invOpts.length === 0) {
      showToast("لا توجد قطع متاحة", "error");
      return;
    }
    const html = `
        <div class="modal-overlay" id="saleModal">
            <div class="modal"><div class="modal-header"><h3>🛒 بيع</h3><button class="modal-close" onclick="closeModal('saleModal')">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label>العميل (ابحث أو اكتب اسماً جديداً)</label><input id="saleCustomerInput" placeholder="اكتب اسم العميل..."></div>
                <div class="form-group"><label>القطعة (ابحث أو اكتب)</label><input id="saleInventoryInput" placeholder="اكتب اسم القطعة..."></div>
                <div class="form-row"><div class="form-group"><label>الكمية</label><input type="number" id="saleQty" value="1" min="1" oninput="updateSaleTotal()"></div>
                <div class="form-group"><label>سعر البيع للوحدة *</label><input type="number" id="saleUnitPrice" step="0.01" oninput="updateSaleTotal()" placeholder="أدخل سعر البيع"></div></div>
                <div class="form-row"><div class="form-group"><label>الإجمالي</label><input id="saleTotal" readonly style="background:#f1f5f9;font-weight:700;"></div>
                <div class="form-group"><label>المدفوع</label><input type="number" id="salePaid" value="0" step="0.01" oninput="updateSaleRemaining()"></div></div>
                <div class="form-group"><label>المتبقي</label><input id="saleRemaining" readonly style="background:#fef3c7;font-weight:700;color:var(--danger);"></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('saleModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="saveSale()">💾 حفظ</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;

    // Searchable selects
    setTimeout(() => {
      window._saleCustomerSelect = initSearchableSelect(
        "saleCustomerInput",
        custOpts,
        (val, text) => {},
      );
      window._saleInventorySelect = initSearchableSelect(
        "saleInventoryInput",
        invOpts,
        (val, text) => {
          updateSaleTotal();
        },
      );
      updateSaleTotal();
    }, 100);
  };

  window.updateSaleTotal = function () {
    const qty = parseInt(document.getElementById("saleQty")?.value) || 0;
    const price =
      parseFloat(document.getElementById("saleUnitPrice")?.value) || 0;
    const total = qty * price;
    const totalInput = document.getElementById("saleTotal");
    if (totalInput) totalInput.value = total.toFixed(2);
    updateSaleRemaining();
  };
  window.updateSaleRemaining = function () {
    const total = parseFloat(document.getElementById("saleTotal")?.value) || 0;
    const paid = parseFloat(document.getElementById("salePaid")?.value) || 0;
    const rem = document.getElementById("saleRemaining");
    if (rem) rem.value = Math.max(0, total - paid).toFixed(2);
  };

  window.saveSale = function () {
    const customerInput = document
      .getElementById("saleCustomerInput")
      ?.value.trim();
    const inventoryInput = document
      .getElementById("saleInventoryInput")
      ?.value.trim();
    const quantity = parseInt(document.getElementById("saleQty")?.value) || 0;
    const unitPrice =
      parseFloat(document.getElementById("saleUnitPrice")?.value) || 0;
    const total = parseFloat(document.getElementById("saleTotal")?.value) || 0;
    const paid = parseFloat(document.getElementById("salePaid")?.value) || 0;
    const remaining = Math.max(0, total - paid);

    if (!customerInput || !inventoryInput || quantity <= 0 || unitPrice <= 0) {
      showToast("بيانات غير صحيحة", "error");
      return;
    }

    // البحث عن العميل أو إنشاء جديد
    let customerId = window._saleCustomerSelect?.getValue();
    if (!customerId) {
      // إنشاء عميل جديد
      const newCust = {
        id: generateId("customer"),
        name: customerInput,
        phone: "",
        address: "",
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      db.customers.push(newCust);
      customerId = newCust.id;
    } else {
      customerId = parseInt(customerId);
    }

    // البحث عن القطعة
    let inventoryId = window._saleInventorySelect?.getValue();
    if (!inventoryId) {
      showToast("الرجاء اختيار قطعة من القائمة", "error");
      return;
    }
    inventoryId = parseInt(inventoryId);

    const inv = getInventoryById(inventoryId);
    if (!inv || inv.quantity < quantity) {
      showToast("المخزون غير كاف", "error");
      return;
    }

    inv.quantity -= quantity;
    const sale = {
      id: generateId("sale"),
      customerId,
      inventoryId,
      quantity,
      unitPrice,
      total,
      paid,
      remaining,
      purchasePriceAtSale: inv.purchasePrice || 0,
      date: new Date().toISOString(),
    };
    db.sales.push(sale);
    updateCustomerBalance(customerId);
    saveDB(db);
    closeModal("saleModal");
    renderSales();
    renderInventory();
    renderDashboard();
    showToast("تم البيع ✅");
  };

  window.deleteSale = function (id) {
    const sale = db.sales.find((s) => s.id === id);
    if (!sale) return;
    if (!confirm("حذف الفاتورة؟")) return;
    const inv = getInventoryById(sale.inventoryId);
    if (inv) inv.quantity += sale.quantity;
    const returns = db.salesReturns.filter((r) => r.saleId === id);
    returns.forEach((r) => {
      const inv2 = getInventoryById(r.inventoryId);
      if (inv2) inv2.quantity += r.quantity;
    });
    db.salesReturns = db.salesReturns.filter((r) => r.saleId !== id);
    db.sales = db.sales.filter((s) => s.id !== id);
    updateCustomerBalance(sale.customerId);
    saveDB(db);
    renderSales();
    renderInventory();
    renderDashboard();
    showToast("تم الحذف 🗑️");
  };

  window.openSalesReturnModal = function (saleId) {
    const sale = db.sales.find((s) => s.id === saleId);
    if (!sale) return;
    const inv = getInventoryById(sale.inventoryId);
    const already = db.salesReturns
      .filter((r) => r.saleId === saleId)
      .reduce((s, r) => s + r.quantity, 0);
    const max = sale.quantity - already;
    if (max <= 0) {
      showToast("لا يمكن إرجاع كمية إضافية", "error");
      return;
    }
    const html = `
        <div class="modal-overlay" id="retModal">
            <div class="modal"><div class="modal-header"><h3>↩️ مرتجع بيع #${sale.id}</h3><button class="modal-close" onclick="closeModal('retModal')">✕</button></div>
            <div class="modal-body"><p>القطعة: ${inv ? inv.partName : "?"} | أقصى إرجاع: ${max}</p>
            <div class="form-group"><label>الكمية</label><input type="number" id="retQty" min="1" max="${max}" value="1"></div>
            <div class="form-group"><label>السبب</label><input id="retReason"></div></div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('retModal')">إلغاء</button>
            <button class="btn btn-danger" onclick="saveSalesReturn(${saleId})">تأكيد</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
  };
  window.saveSalesReturn = function (saleId) {
    const sale = db.sales.find((s) => s.id === saleId);
    if (!sale) return;
    const qty = parseInt(document.getElementById("retQty")?.value) || 0;
    const reason = document.getElementById("retReason")?.value || "";
    const already = db.salesReturns
      .filter((r) => r.saleId === saleId)
      .reduce((s, r) => s + r.quantity, 0);
    if (qty <= 0 || qty > sale.quantity - already) {
      showToast("كمية غير صالحة", "error");
      return;
    }
    const inv = getInventoryById(sale.inventoryId);
    if (inv) inv.quantity += qty;
    db.salesReturns.push({
      id: generateId("salesReturn"),
      saleId,
      customerId: sale.customerId,
      inventoryId: sale.inventoryId,
      quantity: qty,
      date: new Date().toISOString(),
      reason,
    });
    updateCustomerBalance(sale.customerId);
    saveDB(db);
    closeModal("retModal");
    renderSales();
    renderInventory();
    renderDashboard();
    showToast("تم المرتجع ✅");
  };

  // ============ المشتريات ============
  function renderPurchases() {
    const search = (
      document.getElementById("purchaseSearch")?.value || ""
    ).toLowerCase();
    let filtered = db.purchases.filter((p) => {
      const s = getSupplierById(p.supplierId);
      const inv = getInventoryById(p.inventoryId);
      return (
        (s && s.name.toLowerCase().includes(search)) ||
        (inv && inv.partName.toLowerCase().includes(search))
      );
    });
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById("purchasesTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="11"><div class="empty-state">📥 لا توجد مشتريات</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((p) => {
        const s = getSupplierById(p.supplierId);
        const inv = getInventoryById(p.inventoryId);
        const returns = db.purchaseReturns
          .filter((r) => r.purchaseId === p.id)
          .reduce((sum, r) => sum + r.quantity, 0);
        const netQty = p.quantity - returns;
        const status =
          p.remaining <= 0
            ? '<span class="badge badge-success">✅ مسدد</span>'
            : '<span class="badge badge-danger">📌 دين</span>';
        return `<tr>
                <td>${p.id}</td><td>${formatDate(p.date)}</td><td>${s ? s.name : "?"}</td><td>${inv ? inv.partName : "?"}</td>
                <td>${netQty}${returns > 0 ? ` <small style="color:var(--danger)">(مرتجع ${returns})</small>` : ""}</td>
                <td>${formatCurrency(p.unitPrice)}</td><td>${formatCurrency(p.total)}</td><td>${formatCurrency(p.paid)}</td>
                <td>${formatCurrency(p.remaining)}</td><td>${status}</td>
                <td><button class="btn btn-danger btn-xs" onclick="deletePurchase(${p.id})">🗑️</button>
                <button class="btn btn-xs" onclick="openPurchaseReturnModal(${p.id})" style="background:var(--warning);color:#fff;">↩️ مرتجع</button></td></tr>`;
      })
      .join("");
  }

  window.openPurchaseModal = function () {
    const supOpts = db.suppliers.map((s) => ({
      value: String(s.id),
      text: `${s.name} - ${s.phone || ""}`,
    }));
    const invOpts = db.inventory.map((i) => ({
      value: String(i.id),
      text: `${i.partName} (${i.partNumber || ""})`,
    }));
    const html = `
        <div class="modal-overlay" id="purModal">
            <div class="modal"><div class="modal-header"><h3>🧾 شراء</h3><button class="modal-close" onclick="closeModal('purModal')">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label>المورد (ابحث أو اكتب)</label><input id="purSupplierInput" placeholder="اكتب اسم المورد..."></div>
                <div class="form-group"><label>القطعة (ابحث أو اكتب)</label><input id="purInventoryInput" placeholder="اكتب اسم القطعة..."></div>
                <div class="form-row"><div class="form-group"><label>الكمية</label><input type="number" id="purQty" value="1" min="1" oninput="updatePurTotal()"></div>
                <div class="form-group"><label>سعر الشراء</label><input type="number" id="purUnitPrice" step="0.01" oninput="updatePurTotal()"></div></div>
                <div class="form-row"><div class="form-group"><label>الإجمالي</label><input id="purTotal" readonly style="background:#f1f5f9;font-weight:700;"></div>
                <div class="form-group"><label>المدفوع</label><input type="number" id="purPaid" value="0" step="0.01" oninput="updatePurRemaining()"></div></div>
                <div class="form-group"><label>المتبقي</label><input id="purRemaining" readonly style="background:#fef3c7;font-weight:700;color:var(--danger);"></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('purModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="savePurchase()">💾 حفظ</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
    setTimeout(() => {
      window._purSupplierSelect = initSearchableSelect(
        "purSupplierInput",
        supOpts,
        (val, text) => {},
      );
      window._purInventorySelect = initSearchableSelect(
        "purInventoryInput",
        invOpts,
        (val, text) => {
          updatePurTotal();
        },
      );
      updatePurTotal();
    }, 100);
  };
  window.updatePurTotal = function () {
    const qty = parseInt(document.getElementById("purQty")?.value) || 0;
    const price =
      parseFloat(document.getElementById("purUnitPrice")?.value) || 0;
    const total = qty * price;
    const ti = document.getElementById("purTotal");
    if (ti) ti.value = total.toFixed(2);
    updatePurRemaining();
  };
  window.updatePurRemaining = function () {
    const total = parseFloat(document.getElementById("purTotal")?.value) || 0;
    const paid = parseFloat(document.getElementById("purPaid")?.value) || 0;
    const ri = document.getElementById("purRemaining");
    if (ri) ri.value = Math.max(0, total - paid).toFixed(2);
  };
  window.savePurchase = function () {
    const supplierInput = document
      .getElementById("purSupplierInput")
      ?.value.trim();
    const inventoryInput = document
      .getElementById("purInventoryInput")
      ?.value.trim();
    const quantity = parseInt(document.getElementById("purQty")?.value) || 0;
    const unitPrice =
      parseFloat(document.getElementById("purUnitPrice")?.value) || 0;
    const total = parseFloat(document.getElementById("purTotal")?.value) || 0;
    const paid = parseFloat(document.getElementById("purPaid")?.value) || 0;
    const remaining = Math.max(0, total - paid);
    if (!supplierInput || !inventoryInput || quantity <= 0 || unitPrice <= 0) {
      showToast("بيانات غير صحيحة", "error");
      return;
    }
    let supplierId = window._purSupplierSelect?.getValue();
    if (!supplierId) {
      const newSup = {
        id: generateId("supplier"),
        name: supplierInput,
        phone: "",
        address: "",
        balance: 0,
        createdAt: new Date().toISOString(),
      };
      db.suppliers.push(newSup);
      supplierId = newSup.id;
    } else {
      supplierId = parseInt(supplierId);
    }
    let inventoryId = window._purInventorySelect?.getValue();
    if (!inventoryId) {
      showToast("اختر قطعة من القائمة", "error");
      return;
    }
    inventoryId = parseInt(inventoryId);
    const inv = getInventoryById(inventoryId);
    if (!inv) {
      showToast("القطعة غير موجودة", "error");
      return;
    }
    inv.quantity += quantity;
    inv.purchasePrice = unitPrice;
    db.purchases.push({
      id: generateId("purchase"),
      supplierId,
      inventoryId,
      quantity,
      unitPrice,
      total,
      paid,
      remaining,
      date: new Date().toISOString(),
    });
    updateSupplierBalance(supplierId);
    saveDB(db);
    closeModal("purModal");
    renderPurchases();
    renderInventory();
    renderDashboard();
    showToast("تم الشراء ✅");
  };
  window.deletePurchase = function (id) {
    const p = db.purchases.find((x) => x.id === id);
    if (!p) return;
    if (!confirm("حذف الفاتورة؟")) return;
    const inv = getInventoryById(p.inventoryId);
    if (inv) inv.quantity = Math.max(0, inv.quantity - p.quantity);
    const returns = db.purchaseReturns.filter((r) => r.purchaseId === id);
    returns.forEach((r) => {
      const inv2 = getInventoryById(r.inventoryId);
      if (inv2) inv2.quantity = Math.max(0, inv2.quantity - r.quantity);
    });
    db.purchaseReturns = db.purchaseReturns.filter((r) => r.purchaseId !== id);
    db.purchases = db.purchases.filter((x) => x.id !== id);
    updateSupplierBalance(p.supplierId);
    saveDB(db);
    renderPurchases();
    renderInventory();
    renderDashboard();
    showToast("تم الحذف");
  };
  window.openPurchaseReturnModal = function (purchaseId) {
    const p = db.purchases.find((x) => x.id === purchaseId);
    if (!p) return;
    const inv = getInventoryById(p.inventoryId);
    const already = db.purchaseReturns
      .filter((r) => r.purchaseId === purchaseId)
      .reduce((s, r) => s + r.quantity, 0);
    const max = p.quantity - already;
    if (max <= 0) {
      showToast("لا يمكن إرجاع كمية إضافية", "error");
      return;
    }
    const html = `
        <div class="modal-overlay" id="retPurModal">
            <div class="modal"><div class="modal-header"><h3>↩️ مرتجع شراء #${p.id}</h3><button class="modal-close" onclick="closeModal('retPurModal')">✕</button></div>
            <div class="modal-body"><p>القطعة: ${inv ? inv.partName : "?"} | أقصى إرجاع: ${max}</p>
            <div class="form-group"><label>الكمية</label><input type="number" id="retPurQty" min="1" max="${max}" value="1"></div>
            <div class="form-group"><label>السبب</label><input id="retPurReason"></div></div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('retPurModal')">إلغاء</button>
            <button class="btn btn-danger" onclick="savePurchaseReturn(${purchaseId})">تأكيد</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
  };
  window.savePurchaseReturn = function (purchaseId) {
    const p = db.purchases.find((x) => x.id === purchaseId);
    if (!p) return;
    const qty = parseInt(document.getElementById("retPurQty")?.value) || 0;
    const reason = document.getElementById("retPurReason")?.value || "";
    const already = db.purchaseReturns
      .filter((r) => r.purchaseId === purchaseId)
      .reduce((s, r) => s + r.quantity, 0);
    if (qty <= 0 || qty > p.quantity - already) {
      showToast("كمية غير صالحة", "error");
      return;
    }
    const inv = getInventoryById(p.inventoryId);
    if (inv) inv.quantity = Math.max(0, inv.quantity - qty);
    db.purchaseReturns.push({
      id: generateId("purchaseReturn"),
      purchaseId,
      supplierId: p.supplierId,
      inventoryId: p.inventoryId,
      quantity: qty,
      date: new Date().toISOString(),
      reason,
    });
    updateSupplierBalance(p.supplierId);
    saveDB(db);
    closeModal("retPurModal");
    renderPurchases();
    renderInventory();
    renderDashboard();
    showToast("تم المرتجع ✅");
  };

  // ============ التسديدات ============
  function renderPayments() {
    const search = (
      document.getElementById("paymentSearch")?.value || ""
    ).toLowerCase();
    let filtered = db.payments.filter((p) => {
      const c = getCustomerById(p.customerId);
      return c && c.name.toLowerCase().includes(search);
    });
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById("paymentsTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state">💳 لا توجد تسديدات</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((p) => {
        const c = getCustomerById(p.customerId);
        return `<tr><td>${p.id}</td><td>${formatDate(p.date)}</td><td>${c ? c.name : "?"}</td><td>${formatCurrency(p.amount)}</td><td>${p.note || "-"}</td>
            <td><button class="btn btn-danger btn-xs" onclick="deletePayment(${p.id})">🗑️</button></td></tr>`;
      })
      .join("");
  }
  window.openPaymentModal = function () {
    const custOpts = db.customers.map((c) => ({
      value: String(c.id),
      text: `${c.name} - رصيد: ${formatCurrency(c.balance || 0)}`,
    }));
    const html = `
        <div class="modal-overlay" id="payModal">
            <div class="modal"><div class="modal-header"><h3>💵 تسجيل دفعة</h3><button class="modal-close" onclick="closeModal('payModal')">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label>العميل (ابحث)</label><input id="payCustomerInput" placeholder="ابحث عن عميل..."></div>
                <div class="form-row"><div class="form-group"><label>المبلغ</label><input type="number" id="payAmount" step="0.01"></div>
                <div class="form-group"><label>التاريخ</label><input type="date" id="payDate"></div></div>
                <div class="form-group"><label>ملاحظات</label><textarea id="payNote" rows="2"></textarea></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('payModal')">إلغاء</button>
            <button class="btn btn-success" onclick="savePayment()">💾 حفظ</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
    document.getElementById("payDate").value = new Date()
      .toISOString()
      .split("T")[0];
    setTimeout(() => {
      window._payCustomerSelect = initSearchableSelect(
        "payCustomerInput",
        custOpts,
        () => {},
      );
    }, 100);
  };
  window.savePayment = function () {
    const customerId = parseInt(window._payCustomerSelect?.getValue());
    const amount = parseFloat(document.getElementById("payAmount")?.value) || 0;
    const date = document.getElementById("payDate")?.value;
    const note = document.getElementById("payNote")?.value || "";
    if (!customerId || amount <= 0) {
      showToast("بيانات غير صحيحة", "error");
      return;
    }
    distributeCustomerPayment(customerId, amount);
    db.payments.push({
      id: generateId("payment"),
      customerId,
      amount,
      date: new Date(date).toISOString(),
      note,
      createdAt: new Date().toISOString(),
    });
    updateCustomerBalance(customerId);
    saveDB(db);
    closeModal("payModal");
    renderPayments();
    renderDashboard();
    renderCustomers();
    showToast("تم التسديد ✅");
  };
  window.deletePayment = function (id) {
    const p = db.payments.find((x) => x.id === id);
    if (!p) return;
    if (!confirm("حذف الدفعة؟")) return;
    db.payments = db.payments.filter((x) => x.id !== id);
    updateCustomerBalance(p.customerId);
    saveDB(db);
    renderPayments();
    renderDashboard();
    renderCustomers();
    showToast("تم الحذف");
  };

  // ============ مدفوعات الموردين ============
  function renderSupplierPayments() {
    const search = (
      document.getElementById("supplierPaymentSearch")?.value || ""
    ).toLowerCase();
    let filtered = db.supplierPayments.filter((sp) => {
      const s = getSupplierById(sp.supplierId);
      return s && s.name.toLowerCase().includes(search);
    });
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById("supplierPaymentsTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state">🏦 لا توجد مدفوعات</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((sp) => {
        const s = getSupplierById(sp.supplierId);
        return `<tr><td>${sp.id}</td><td>${formatDate(sp.date)}</td><td>${s ? s.name : "?"}</td><td>${formatCurrency(sp.amount)}</td><td>${sp.note || "-"}</td>
            <td><button class="btn btn-danger btn-xs" onclick="deleteSupplierPayment(${sp.id})">🗑️</button></td></tr>`;
      })
      .join("");
  }
  window.openSupplierPaymentModal = function () {
    const supOpts = db.suppliers.map((s) => ({
      value: String(s.id),
      text: `${s.name} - رصيد: ${formatCurrency(s.balance || 0)}`,
    }));
    const html = `
        <div class="modal-overlay" id="supPayModal">
            <div class="modal"><div class="modal-header"><h3>💵 دفع لمورد</h3><button class="modal-close" onclick="closeModal('supPayModal')">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label>المورد (ابحث)</label><input id="supPaySupplierInput" placeholder="ابحث عن مورد..."></div>
                <div class="form-row"><div class="form-group"><label>المبلغ</label><input type="number" id="supPayAmount" step="0.01"></div>
                <div class="form-group"><label>التاريخ</label><input type="date" id="supPayDate"></div></div>
                <div class="form-group"><label>ملاحظات</label><textarea id="supPayNote" rows="2"></textarea></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('supPayModal')">إلغاء</button>
            <button class="btn btn-success" onclick="saveSupplierPayment()">💾 حفظ</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
    document.getElementById("supPayDate").value = new Date()
      .toISOString()
      .split("T")[0];
    setTimeout(() => {
      window._supPaySupplierSelect = initSearchableSelect(
        "supPaySupplierInput",
        supOpts,
        () => {},
      );
    }, 100);
  };
  window.saveSupplierPayment = function () {
    const supplierId = parseInt(window._supPaySupplierSelect?.getValue());
    const amount =
      parseFloat(document.getElementById("supPayAmount")?.value) || 0;
    const date = document.getElementById("supPayDate")?.value;
    const note = document.getElementById("supPayNote")?.value || "";
    if (!supplierId || amount <= 0) {
      showToast("بيانات غير صحيحة", "error");
      return;
    }
    distributeSupplierPayment(supplierId, amount);
    db.supplierPayments.push({
      id: generateId("supplierPayment"),
      supplierId,
      amount,
      date: new Date(date).toISOString(),
      note,
      createdAt: new Date().toISOString(),
    });
    updateSupplierBalance(supplierId);
    saveDB(db);
    closeModal("supPayModal");
    renderSupplierPayments();
    renderDashboard();
    renderSuppliers();
    showToast("تم الدفع ✅");
  };
  window.deleteSupplierPayment = function (id) {
    const sp = db.supplierPayments.find((x) => x.id === id);
    if (!sp) return;
    if (!confirm("حذف الدفعة؟")) return;
    db.supplierPayments = db.supplierPayments.filter((x) => x.id !== id);
    updateSupplierBalance(sp.supplierId);
    saveDB(db);
    renderSupplierPayments();
    renderDashboard();
    renderSuppliers();
    showToast("تم الحذف");
  };

  // ============ السحوبات ============
  function renderWithdrawals() {
    const search = (
      document.getElementById("withdrawalSearch")?.value || ""
    ).toLowerCase();
    let filtered = db.withdrawals.filter(
      (w) =>
        w.personName.toLowerCase().includes(search) ||
        (w.reason || "").toLowerCase().includes(search),
    );
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById("withdrawalsTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state">💸 لا توجد سحوبات</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map(
        (w) => `
            <tr><td>${w.id}</td><td>${formatDate(w.date)}</td><td>${w.personName}</td><td style="color:var(--danger);font-weight:700;">${formatCurrency(w.amount)}</td><td>${w.reason || "-"}</td>
            <td><button class="btn btn-danger btn-xs" onclick="deleteWithdrawal(${w.id})">🗑️</button></td></tr>
        `,
      )
      .join("");
  }
  window.openWithdrawalModal = function () {
    const html = `
        <div class="modal-overlay" id="withModal">
            <div class="modal"><div class="modal-header"><h3>💸 تسجيل سحب من الخزينة</h3><button class="modal-close" onclick="closeModal('withModal')">✕</button></div>
            <div class="modal-body">
                <div class="form-group"><label>اسم الشخص *</label><input id="withPerson" placeholder="اسم الشخص الذي قام بالسحب"></div>
                <div class="form-row"><div class="form-group"><label>المبلغ *</label><input type="number" id="withAmount" step="0.01"></div>
                <div class="form-group"><label>التاريخ</label><input type="date" id="withDate"></div></div>
                <div class="form-group"><label>السبب</label><textarea id="withReason" rows="2" placeholder="سبب السحب..."></textarea></div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('withModal')">إلغاء</button>
            <button class="btn btn-danger" onclick="saveWithdrawal()">💾 تسجيل السحب</button></div></div></div>`;
    document.getElementById("modalContainer").innerHTML = html;
    document.getElementById("withDate").value = new Date()
      .toISOString()
      .split("T")[0];
  };
  window.saveWithdrawal = function () {
    const personName = document.getElementById("withPerson")?.value.trim();
    const amount =
      parseFloat(document.getElementById("withAmount")?.value) || 0;
    const date = document.getElementById("withDate")?.value;
    const reason = document.getElementById("withReason")?.value.trim() || "";
    if (!personName || amount <= 0) {
      showToast("الرجاء إدخال الاسم والمبلغ", "error");
      return;
    }
    db.withdrawals.push({
      id: generateId("withdrawal"),
      personName,
      amount,
      date: new Date(date).toISOString(),
      reason,
      createdAt: new Date().toISOString(),
    });
    saveDB(db);
    closeModal("withModal");
    renderWithdrawals();
    renderDashboard();
    showToast("تم تسجيل السحب 💸");
  };
  window.deleteWithdrawal = function (id) {
    if (!confirm("حذف هذا السحب؟")) return;
    db.withdrawals = db.withdrawals.filter((w) => w.id !== id);
    saveDB(db);
    renderWithdrawals();
    renderDashboard();
    showToast("تم الحذف");
  };

  // ============ التقارير ============
  function renderReports() {
    const totalCustDebts = db.customers.reduce(
      (s, c) => s + Math.max(0, c.balance || 0),
      0,
    );
    const totalSuppDebts = db.suppliers.reduce(
      (s, sup) => s + Math.max(0, sup.balance || 0),
      0,
    );
    const inventoryCost = db.inventory.reduce(
      (s, i) => s + i.quantity * i.purchasePrice,
      0,
    );
    const lowStock = db.inventory.filter(
      (i) => i.quantity <= (i.minAlert || 5),
    ).length;
    const totalWithdrawals = db.withdrawals.reduce((s, w) => s + w.amount, 0);

    document.getElementById("reportStats").innerHTML = `
            <div class="stat-card"><div class="stat-icon red">💸</div><div class="stat-info"><h3>ديون العملاء</h3><div class="value">${formatCurrency(totalCustDebts)}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange">🏦</div><div class="stat-info"><h3>ديون للموردين</h3><div class="value">${formatCurrency(totalSuppDebts)}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-info"><h3>قيمة المخزون (شراء)</h3><div class="value">${formatCurrency(inventoryCost)}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange">⚠️</div><div class="stat-info"><h3>مخزون منخفض</h3><div class="value">${lowStock}</div></div></div>
        `;
    document.getElementById("inventoryCostValue").innerHTML =
      `<div style="display:flex;justify-content:space-between;"><span>📦 قيمة المخزون بسعر الشراء:</span><span style="font-size:24px;color:var(--primary);">${formatCurrency(inventoryCost)}</span></div>`;
    document.getElementById("totalWithdrawals").innerHTML =
      `<div style="display:flex;justify-content:space-between;"><span>💸 إجمالي السحوبات:</span><span style="font-size:24px;color:var(--danger);">${formatCurrency(totalWithdrawals)}</span></div>`;

    // الأرباح الشهرية
    const monthly = {};
    db.sales.forEach((s) => {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthly[key])
        monthly[key] = { sales: 0, cost: 0, count: 0, returns: 0 };
      monthly[key].sales += s.total;
      monthly[key].cost += (s.purchasePriceAtSale || 0) * s.quantity;
      monthly[key].count++;
    });
    db.salesReturns.forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthly[key])
        monthly[key] = { sales: 0, cost: 0, count: 0, returns: 0 };
      const sale = db.sales.find((s) => s.id === r.saleId);
      if (sale) {
        monthly[key].returns += r.quantity * sale.unitPrice;
        monthly[key].cost -= (sale.purchasePriceAtSale || 0) * r.quantity;
      }
    });
    const months = Object.entries(monthly).sort((a, b) =>
      b[0].localeCompare(a[0]),
    );
    const tbody = document.getElementById("monthlyProfitBody");
    if (months.length === 0)
      tbody.innerHTML = '<tr><td colspan="5">لا توجد بيانات</td></tr>';
    else
      tbody.innerHTML = months
        .map(([m, d]) => {
          const net = d.sales - d.returns;
          const profit = net - d.cost;
          return `<tr><td>${m}</td><td>${d.count}</td><td>${formatCurrency(net)}</td><td>${formatCurrency(d.cost)}</td><td style="color:${profit >= 0 ? "var(--success)" : "var(--danger)"};font-weight:700;">${formatCurrency(profit)}</td></tr>`;
        })
        .join("");
  }

  // ============ دوال عامة ============
  window.closeModal = function (overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();
    document.getElementById("modalContainer").innerHTML = "";
  };
  document
    .getElementById("modalContainer")
    .addEventListener("click", function (e) {
      if (e.target.classList.contains("modal-overlay")) e.target.remove();
    });

  // ============ تصدير/استيراد ============
  window.exportData = function () {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      showToast("لا توجد بيانات", "error");
      return;
    }
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast("تم التصدير ✅");
  };
  window.importData = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        JSON.parse(e.target.result);
        localStorage.setItem(STORAGE_KEY, e.target.result);
        showToast("تم الاستيراد ✅");
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showToast("ملف غير صالح", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // ============ بيانات تجريبية ============
  function seedDemoData() {
    if (db.customers.length === 0) {
      db.customers.push({
        id: generateId("customer"),
        name: "أحمد محمد",
        phone: "01001234567",
        address: "القاهرة",
        balance: 0,
      });
      db.customers.push({
        id: generateId("customer"),
        name: "محمود علي",
        phone: "01111234567",
        address: "الجيزة",
        balance: 0,
      });
    }
    if (db.suppliers.length === 0) {
      db.suppliers.push({
        id: generateId("supplier"),
        name: "شركة النور",
        phone: "02222222",
        address: "القاهرة",
        balance: 0,
      });
    }
    if (db.inventory.length === 0) {
      db.inventory.push({
        id: generateId("inventory"),
        partName: "فلتر زيت",
        partNumber: "FO-001",
        category: "فلاتر",
        quantity: 25,
        minAlert: 5,
        purchasePrice: 50,
        supplier: "",
        image: "",
      });
      db.inventory.push({
        id: generateId("inventory"),
        partName: "بطارية 70 أمبير",
        partNumber: "BAT-070",
        category: "بطاريات",
        quantity: 8,
        minAlert: 3,
        purchasePrice: 1800,
        supplier: "",
        image: "",
      });
    }
    saveDB(db);
  }

  function init() {
    if (!db.withdrawals) db.withdrawals = [];
    if (!db.suppliers) db.suppliers = [];
    if (!db.purchases) db.purchases = [];
    if (!db.supplierPayments) db.supplierPayments = [];
    if (!db.salesReturns) db.salesReturns = [];
    if (!db.purchaseReturns) db.purchaseReturns = [];
    if (!db.nextIds) db.nextIds = {};
    db.customers.forEach((c) => updateCustomerBalance(c.id));
    db.suppliers.forEach((s) => updateSupplierBalance(s.id));
    saveDB(db);
    if (db.customers.length === 0 && db.inventory.length === 0) seedDemoData();
    renderDashboard();
    console.log("✅ النظام جاهز");
  }
  init();
})();
