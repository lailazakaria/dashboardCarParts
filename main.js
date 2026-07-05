(function () {
  // ============ البيانات والتخزين ============
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
      inventory: [],
      sales: [],
      payments: [],
      nextIds: { customer: 1, inventory: 1, sale: 1, payment: 1 },
    };
  }

  function saveDB(db) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  let db = getDB();

  function generateId(type) {
    const id = db.nextIds[type] || 1;
    db.nextIds[type] = id + 1;
    saveDB(db);
    return id;
  }

  // ============ دوال مساعدة ============
  function formatCurrency(amount) {
    return (
      parseFloat(amount || 0).toLocaleString("ar-EG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + "SP"
    );
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getCustomerById(id) {
    return db.customers.find((c) => c.id === id);
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
    const paymentsTotal = db.payments
      .filter((p) => p.customerId === customerId)
      .reduce((sum, p) => sum + p.amount, 0);
    customer.balance = salesTotal - paymentsTotal;
    saveDB(db);
  }

  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
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
      `.sidebar-nav a[data-page="${pageName}"]`
    );
    if (link) link.classList.add("active");
    if (window.innerWidth <= 768) {
      sidebar.classList.remove("open");
    }
    refreshPage(pageName);
  }

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const pageName = link.getAttribute("data-page");
      navigateTo(pageName);
    });
  });

  mobileMenuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

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
      case "inventory":
        renderInventory();
        break;
      case "sales":
        renderSales();
        break;
      case "payments":
        renderPayments();
        break;
      case "reports":
        renderReports();
        break;
    }
  }

  // ============ لوحة التحكم ============
  function renderDashboard() {
    const totalCustomers = db.customers.length;
    const totalInventoryItems = db.inventory.length;
    const totalInventoryQty = db.inventory.reduce(
      (s, i) => s + (i.quantity || 0),
      0
    );
    const totalDebts = db.customers.reduce(
      (s, c) => s + Math.max(0, c.balance || 0),
      0
    );
    const totalCredits = db.customers.reduce(
      (s, c) => s + Math.max(0, -(c.balance || 0)),
      0
    );
    const totalSales = db.sales.reduce((s, sl) => s + (sl.total || 0), 0);
    const totalPaid = db.sales.reduce((s, sl) => s + (sl.paid || 0), 0);
    const totalRemaining = db.sales.reduce(
      (s, sl) => s + (sl.remaining || 0),
      0
    );
    const lowStock = db.inventory.filter(
      (i) => i.quantity <= (i.minAlert || 5)
    ).length;

    document.getElementById("dashboardStats").innerHTML = `
            <div class="stat-card"><div class="stat-icon blue">👥</div><div class="stat-info"><h3>العملاء</h3><div class="value">${totalCustomers}</div></div></div>
            <div class="stat-card"><div class="stat-icon green">📦</div><div class="stat-info"><h3>القطع بالمخزون</h3><div class="value">${totalInventoryItems}</div><small>الكمية الإجمالية: ${totalInventoryQty}</small></div></div>
            <div class="stat-card"><div class="stat-icon red">💸</div><div class="stat-info"><h3>إجمالي الديون على العملاء</h3><div class="value positive">${formatCurrency(
              totalDebts
            )}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange">⚠️</div><div class="stat-info"><h3>قطع منخفضة المخزون</h3><div class="value">${lowStock}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">🛒</div><div class="stat-info"><h3>إجمالي المبيعات</h3><div class="value">${formatCurrency(
              totalSales
            )}</div></div></div>
            <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><h3>المدفوع</h3><div class="value">${formatCurrency(
              totalPaid
            )}</div><small>المتبقي: ${formatCurrency(
      totalRemaining
    )}</small></div></div>
        `;

    const recentSales = [...db.sales]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
    const recentPayments = [...db.payments]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    let activityHTML = "";
    if (recentSales.length === 0 && recentPayments.length === 0) {
      activityHTML =
        '<p class="empty-state"><span class="empty-icon">📭</span>لا توجد عمليات حديثة</p>';
    } else {
      activityHTML = '<ul style="list-style:none;padding:0;">';
      recentSales.forEach((s) => {
        const c = getCustomerById(s.customerId);
        const inv = getInventoryById(s.inventoryId);
        activityHTML += `<li style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
                    🛒 <strong>بيع:</strong> ${
                      inv ? inv.partName : "قطعة"
                    } لـ ${c ? c.name : "عميل"} - ${formatCurrency(
          s.total
        )} | ${formatDate(s.date)}
                    ${
                      s.remaining > 0
                        ? '<span class="badge badge-danger">دين: ' +
                          formatCurrency(s.remaining) +
                          "</span>"
                        : '<span class="badge badge-success">مسدد</span>'
                    }
                    </li>`;
      });
      recentPayments.forEach((p) => {
        const c = getCustomerById(p.customerId);
        activityHTML += `<li style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
                    💵 <strong>تسديد:</strong> ${
                      c ? c.name : "عميل"
                    } - ${formatCurrency(p.amount)} | ${formatDate(p.date)}
                    </li>`;
      });
      activityHTML += "</ul>";
    }
    document.getElementById("recentActivity").innerHTML = activityHTML;
  }

  // ============ العملاء ============
  function renderCustomers() {
    const search = (document.getElementById("customerSearch")?.value || "")
      .trim()
      .toLowerCase();
    let filtered = db.customers;
    if (search) {
      filtered = filtered.filter(
        (c) => c.name.toLowerCase().includes(search) || c.phone.includes(search)
      );
    }
    const tbody = document.getElementById("customersTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">👤</span>لا يوجد عملاء</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((c) => {
        const balance = c.balance || 0;
        let statusBadge = "";
        if (balance > 0)
          statusBadge =
            '<span class="badge badge-danger">مدين (' +
            formatCurrency(balance) +
            ")</span>";
        else if (balance < 0)
          statusBadge =
            '<span class="badge badge-success">دائن (' +
            formatCurrency(Math.abs(balance)) +
            ")</span>";
        else statusBadge = '<span class="badge badge-info">متوازن</span>';
        return `
                <tr>
                    <td>${c.id}</td>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.phone || "-"}</td>
                    <td>${c.address || "-"}</td>
                    <td>${formatCurrency(balance)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-outline btn-xs" onclick="editCustomer(${
                          c.id
                        })">✏️ تعديل</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteCustomer(${
                          c.id
                        })">🗑️ حذف</button>
                    </td>
                </tr>`;
      })
      .join("");
  }

  window.openCustomerModal = function (customer = null) {
    const isEdit = customer !== null;
    const modalHTML = `
        <div class="modal-overlay" id="customerModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? "✏️ تعديل عميل" : "➕ إضافة عميل جديد"}</h3>
                    <button class="modal-close" onclick="closeModal('customerModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label>الاسم *</label><input type="text" id="custName" value="${
                      isEdit ? customer.name : ""
                    }"></div>
                    <div class="form-row">
                        <div class="form-group"><label>رقم الهاتف</label><input type="text" id="custPhone" value="${
                          isEdit ? customer.phone || "" : ""
                        }"></div>
                        <div class="form-group"><label>العنوان</label><input type="text" id="custAddress" value="${
                          isEdit ? customer.address || "" : ""
                        }"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('customerModalOverlay')">إلغاء</button>
                    <button class="btn btn-primary" onclick="saveCustomer(${
                      isEdit ? customer.id : "null"
                    })">💾 ${isEdit ? "تحديث" : "حفظ"}</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    document.getElementById("custName")?.focus();
  };

  window.editCustomer = function (id) {
    const c = getCustomerById(id);
    if (c) window.openCustomerModal(c);
  };

  window.saveCustomer = function (id) {
    const name = document.getElementById("custName")?.value.trim();
    if (!name) {
      showToast("الرجاء إدخال اسم العميل", "error");
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
    closeModal("customerModalOverlay");
    renderCustomers();
    renderDashboard();
    showToast(id ? "تم تحديث العميل بنجاح ✅" : "تم إضافة العميل بنجاح ✅");
  };

  window.deleteCustomer = function (id) {
    const c = getCustomerById(id);
    if (!c) return;
    const hasSales = db.sales.some((s) => s.customerId === id);
    if (hasSales) {
      showToast("لا يمكن حذف العميل - لديه عمليات مبيعات مسجلة", "error");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف العميل "${c.name}"؟`)) return;
    db.customers = db.customers.filter((x) => x.id !== id);
    db.payments = db.payments.filter((p) => p.customerId !== id);
    saveDB(db);
    renderCustomers();
    renderDashboard();
    showToast("تم حذف العميل 🗑️");
  };

  // ============ المستودع ============
  function renderInventory() {
    const search = (document.getElementById("inventorySearch")?.value || "")
      .trim()
      .toLowerCase();
    const catFilter = document.getElementById("categoryFilter")?.value || "";
    let filtered = db.inventory;
    if (search) {
      filtered = filtered.filter(
        (i) =>
          i.partName.toLowerCase().includes(search) ||
          (i.partNumber || "").toLowerCase().includes(search) ||
          (i.supplier || "").toLowerCase().includes(search)
      );
    }
    if (catFilter) {
      filtered = filtered.filter((i) => i.category === catFilter);
    }
    const tbody = document.getElementById("inventoryTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10"><div class="empty-state"><span class="empty-icon">📦</span>المستودع فارغ</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((i) => {
        const lowStock = i.quantity <= (i.minAlert || 5);
        return `
                <tr style="${lowStock ? "background:#fff5f5" : ""}">
                    <td>${i.id}</td>
                    <td><strong>${i.partName}</strong></td>
                    <td>${i.partNumber || "-"}</td>
                    <td><span class="badge badge-info">${
                      i.category || "أخرى"
                    }</span></td>
                    <td><strong>${i.quantity}</strong></td>
                    <td>${formatCurrency(i.purchasePrice)}</td>
                    <td>${formatCurrency(i.sellingPrice)}</td>
                    <td>${i.supplier || "-"}</td>
                    <td>${
                      lowStock
                        ? '<span class="badge badge-danger">⚠️ منخفض</span>'
                        : '<span class="badge badge-success">✅ جيد</span>'
                    }</td>
                    <td>
                        <button class="btn btn-outline btn-xs" onclick="editInventory(${
                          i.id
                        })">✏️</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteInventory(${
                          i.id
                        })">🗑️</button>
                    </td>
                </tr>`;
      })
      .join("");
  }

  window.openInventoryModal = function (item = null) {
    const isEdit = item !== null;
    const categories = [
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
    const catOptions = categories
      .map(
        (c) =>
          `<option value="${c}" ${
            isEdit && item.category === c ? "selected" : ""
          }>${c}</option>`
      )
      .join("");
    const modalHTML = `
        <div class="modal-overlay" id="inventoryModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>${isEdit ? "✏️ تعديل قطعة" : "➕ إضافة قطعة جديدة"}</h3>
                    <button class="modal-close" onclick="closeModal('inventoryModalOverlay')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label>اسم القطعة *</label><input type="text" id="partName" value="${
                      isEdit ? item.partName : ""
                    }"></div>
                    <div class="form-row">
                        <div class="form-group"><label>رقم القطعة</label><input type="text" id="partNumber" value="${
                          isEdit ? item.partNumber || "" : ""
                        }"></div>
                        <div class="form-group"><label>الفئة</label><select id="partCategory">${catOptions}</select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>الكمية *</label><input type="number" id="partQty" value="${
                          isEdit ? item.quantity : 0
                        }" min="0"></div>
                        <div class="form-group"><label>الحد الأدنى للتنبيه</label><input type="number" id="partMinAlert" value="${
                          isEdit ? item.minAlert || 5 : 5
                        }" min="1"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>سعر الشراء</label><input type="number" id="partPurchasePrice" value="${
                          isEdit ? item.purchasePrice || 0 : 0
                        }" step="0.01"></div>
                        <div class="form-group"><label>سعر البيع *</label><input type="number" id="partSellingPrice" value="${
                          isEdit ? item.sellingPrice || 0 : 0
                        }" step="0.01"></div>
                    </div>
                    <div class="form-group"><label>المورد</label><input type="text" id="partSupplier" value="${
                      isEdit ? item.supplier || "" : ""
                    }"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('inventoryModalOverlay')">إلغاء</button>
                    <button class="btn btn-primary" onclick="saveInventory(${
                      isEdit ? item.id : "null"
                    })">💾 ${isEdit ? "تحديث" : "حفظ"}</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
  };

  window.editInventory = function (id) {
    const item = getInventoryById(id);
    if (item) window.openInventoryModal(item);
  };

  window.saveInventory = function (id) {
    const partName = document.getElementById("partName")?.value.trim();
    if (!partName) {
      showToast("الرجاء إدخال اسم القطعة", "error");
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
    const sellingPrice =
      parseFloat(document.getElementById("partSellingPrice")?.value) || 0;
    if (sellingPrice <= 0) {
      showToast("الرجاء إدخال سعر بيع صحيح", "error");
      return;
    }
    const supplier =
      document.getElementById("partSupplier")?.value.trim() || "";
    if (id) {
      const item = getInventoryById(id);
      if (item) {
        item.partName = partName;
        item.partNumber = partNumber;
        item.category = category;
        item.quantity = quantity;
        item.minAlert = minAlert;
        item.purchasePrice = purchasePrice;
        item.sellingPrice = sellingPrice;
        item.supplier = supplier;
      }
    } else {
      db.inventory.push({
        id: generateId("inventory"),
        partName,
        partNumber,
        category,
        quantity,
        minAlert,
        purchasePrice,
        sellingPrice,
        supplier,
        createdAt: new Date().toISOString(),
      });
    }
    saveDB(db);
    closeModal("inventoryModalOverlay");
    renderInventory();
    renderDashboard();
    showToast(id ? "تم تحديث القطعة ✅" : "تم إضافة القطعة ✅");
  };

  window.deleteInventory = function (id) {
    const item = getInventoryById(id);
    if (!item) return;
    const hasSales = db.sales.some((s) => s.inventoryId === id);
    if (hasSales) {
      showToast("لا يمكن حذف القطعة - لديها مبيعات مسجلة", "error");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف "${item.partName}"؟`)) return;
    db.inventory = db.inventory.filter((x) => x.id !== id);
    saveDB(db);
    renderInventory();
    renderDashboard();
    showToast("تم حذف القطعة 🗑️");
  };

  // ============ المبيعات ============
  function renderSales() {
    const search = (document.getElementById("saleSearch")?.value || "")
      .trim()
      .toLowerCase();
    let filtered = db.sales;
    if (search) {
      filtered = filtered.filter((s) => {
        const c = getCustomerById(s.customerId);
        const inv = getInventoryById(s.inventoryId);
        return (
          (c && c.name.toLowerCase().includes(search)) ||
          (inv && inv.partName.toLowerCase().includes(search))
        );
      });
    }
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById("salesTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10"><div class="empty-state"><span class="empty-icon">🛒</span>لا توجد مبيعات</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((s) => {
        const c = getCustomerById(s.customerId);
        const inv = getInventoryById(s.inventoryId);
        const statusBadge =
          s.remaining <= 0
            ? '<span class="badge badge-success">✅ مسدد</span>'
            : '<span class="badge badge-danger">📌 عليه دين</span>';
        return `
                <tr>
                    <td>${s.id}</td>
                    <td>${formatDate(s.date)}</td>
                    <td>${
                      c ? c.name : '<span style="color:#999">محذوف</span>'
                    }</td>
                    <td>${
                      inv
                        ? inv.partName
                        : '<span style="color:#999">محذوفة</span>'
                    }</td>
                    <td>${s.quantity}</td>
                    <td>${formatCurrency(s.total)}</td>
                    <td>${formatCurrency(s.paid)}</td>
                    <td><strong style="color:${
                      s.remaining > 0 ? "var(--danger)" : "var(--success)"
                    }">${formatCurrency(s.remaining)}</strong></td>
                    <td>${statusBadge}</td>
                    <td><button class="btn btn-danger btn-xs" onclick="deleteSale(${
                      s.id
                    })">🗑️</button></td>
                </tr>`;
      })
      .join("");
  }

  window.openSaleModal = function () {
    if (db.customers.length === 0) {
      showToast("الرجاء إضافة عميل أولاً", "error");
      return;
    }
    if (db.inventory.length === 0) {
      showToast("الرجاء إضافة قطع للمستودع أولاً", "error");
      return;
    }
    const customerOptions = db.customers
      .map(
        (c) =>
          `<option value="${c.id}">${c.name} - ${
            c.phone || ""
          } (رصيد: ${formatCurrency(c.balance || 0)})</option>`
      )
      .join("");
    const inventoryOptions = db.inventory
      .filter((i) => i.quantity > 0)
      .map(
        (i) =>
          `<option value="${i.id}" data-price="${i.sellingPrice}" data-stock="${
            i.quantity
          }">${i.partName} (${i.partNumber || "بدون رقم"}) - المتاح: ${
            i.quantity
          } - السعر: ${formatCurrency(i.sellingPrice)}</option>`
      )
      .join("");
    if (!inventoryOptions) {
      showToast("لا توجد قطع متاحة في المخزون للبيع", "error");
      return;
    }
    const modalHTML = `
        <div class="modal-overlay" id="saleModalOverlay">
            <div class="modal">
                <div class="modal-header"><h3>🛒 تسجيل عملية بيع</h3><button class="modal-close" onclick="closeModal('saleModalOverlay')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>العميل *</label><select id="saleCustomer">${customerOptions}</select></div>
                    <div class="form-group"><label>القطعة *</label><select id="saleInventory" onchange="updateSalePrice()">${inventoryOptions}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label>الكمية *</label><input type="number" id="saleQty" value="1" min="1" oninput="updateSaleTotal()"></div>
                        <div class="form-group"><label>سعر البيع للوحدة</label><input type="number" id="saleUnitPrice" step="0.01" oninput="updateSaleTotal()"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>الإجمالي</label><input type="number" id="saleTotal" readonly style="background:#f1f5f9;font-weight:700;"></div>
                        <div class="form-group"><label>المبلغ المدفوع</label><input type="number" id="salePaid" value="0" min="0" step="0.01" oninput="updateSaleRemaining()"></div>
                    </div>
                    <div class="form-group"><label>المتبقي (الدين)</label><input type="number" id="saleRemaining" readonly style="background:#fef3c7;font-weight:700;color:var(--danger);"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('saleModalOverlay')">إلغاء</button>
                    <button class="btn btn-primary" onclick="saveSale()">💾 تسجيل البيع</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    updateSalePrice();
    updateSaleTotal();
  };

  window.updateSalePrice = function () {
    const invSelect = document.getElementById("saleInventory");
    const priceInput = document.getElementById("saleUnitPrice");
    if (invSelect && priceInput && invSelect.selectedOptions[0]) {
      priceInput.value =
        invSelect.selectedOptions[0].getAttribute("data-price") || 0;
    }
    updateSaleTotal();
  };

  window.updateSaleTotal = function () {
    const qty = parseInt(document.getElementById("saleQty")?.value) || 0;
    const price =
      parseFloat(document.getElementById("saleUnitPrice")?.value) || 0;
    const totalInput = document.getElementById("saleTotal");
    if (totalInput) totalInput.value = (qty * price).toFixed(2);
    updateSaleRemaining();
  };

  window.updateSaleRemaining = function () {
    const total = parseFloat(document.getElementById("saleTotal")?.value) || 0;
    const paid = parseFloat(document.getElementById("salePaid")?.value) || 0;
    const remainingInput = document.getElementById("saleRemaining");
    if (remainingInput)
      remainingInput.value = Math.max(0, total - paid).toFixed(2);
  };

  window.saveSale = function () {
    const customerId = parseInt(document.getElementById("saleCustomer")?.value);
    const inventoryId = parseInt(
      document.getElementById("saleInventory")?.value
    );
    const quantity = parseInt(document.getElementById("saleQty")?.value) || 0;
    const unitPrice =
      parseFloat(document.getElementById("saleUnitPrice")?.value) || 0;
    const total = parseFloat(document.getElementById("saleTotal")?.value) || 0;
    const paid = parseFloat(document.getElementById("salePaid")?.value) || 0;
    const remaining = Math.max(0, total - paid);
    if (!customerId || !inventoryId) {
      showToast("الرجاء اختيار العميل والقطعة", "error");
      return;
    }
    if (quantity <= 0) {
      showToast("الرجاء إدخال كمية صحيحة", "error");
      return;
    }
    if (unitPrice <= 0) {
      showToast("الرجاء إدخال سعر بيع صحيح", "error");
      return;
    }
    const inv = getInventoryById(inventoryId);
    if (!inv) {
      showToast("القطعة غير موجودة", "error");
      return;
    }
    if (inv.quantity < quantity) {
      showToast(`المخزون غير كافٍ! المتاح: ${inv.quantity}`, "error");
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
      date: new Date().toISOString(),
    };
    db.sales.push(sale);
    updateCustomerBalance(customerId);
    saveDB(db);
    closeModal("saleModalOverlay");
    renderSales();
    renderInventory();
    renderDashboard();
    showToast(
      `تم تسجيل البيع بنجاح ✅ ${
        remaining > 0
          ? "(دين: " + formatCurrency(remaining) + ")"
          : "(مدفوع كاملاً)"
      }`
    );
  };

  window.deleteSale = function (id) {
    const sale = db.sales.find((s) => s.id === id);
    if (!sale) return;
    if (!confirm("هل أنت متأكد من حذف عملية البيع؟ سيتم إرجاع الكمية للمخزون."))
      return;
    const inv = getInventoryById(sale.inventoryId);
    if (inv) inv.quantity += sale.quantity;
    db.sales = db.sales.filter((s) => s.id !== id);
    updateCustomerBalance(sale.customerId);
    saveDB(db);
    renderSales();
    renderInventory();
    renderDashboard();
    showToast("تم حذف البيع وإرجاع الكمية للمخزون 🗑️");
  };

  // ============ التسديدات ============
  function renderPayments() {
    const search = (document.getElementById("paymentSearch")?.value || "")
      .trim()
      .toLowerCase();
    let filtered = db.payments;
    if (search) {
      filtered = filtered.filter((p) => {
        const c = getCustomerById(p.customerId);
        return c && c.name.toLowerCase().includes(search);
      });
    }
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById("paymentsTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">💳</span>لا توجد تسديدات</div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered
      .map((p) => {
        const c = getCustomerById(p.customerId);
        return `
                <tr>
                    <td>${p.id}</td>
                    <td>${formatDate(p.date)}</td>
                    <td>${
                      c ? c.name : '<span style="color:#999">محذوف</span>'
                    }</td>
                    <td><strong style="color:var(--success)">${formatCurrency(
                      p.amount
                    )}</strong></td>
                    <td>${p.note || "-"}</td>
                    <td><button class="btn btn-danger btn-xs" onclick="deletePayment(${
                      p.id
                    })">🗑️</button></td>
                </tr>`;
      })
      .join("");
  }

  window.openPaymentModal = function () {
    const allCustomers = db.customers.length > 0 ? db.customers : [];
    const customerOptions = allCustomers
      .map(
        (c) =>
          `<option value="${c.id}">${c.name} - رصيد: ${formatCurrency(
            c.balance || 0
          )} ${(c.balance || 0) > 0 ? "🔴 مدين" : ""}</option>`
      )
      .join("");
    const modalHTML = `
        <div class="modal-overlay" id="paymentModalOverlay">
            <div class="modal">
                <div class="modal-header"><h3>💵 تسجيل دفعة من عميل</h3><button class="modal-close" onclick="closeModal('paymentModalOverlay')">✕</button></div>
                <div class="modal-body">
                    <div class="form-group"><label>العميل *</label><select id="paymentCustomer">${customerOptions}</select></div>
                    <div class="form-row">
                        <div class="form-group"><label>المبلغ *</label><input type="number" id="paymentAmount" min="0.01" step="0.01"></div>
                        <div class="form-group"><label>التاريخ</label><input type="date" id="paymentDate" value="${
                          new Date().toISOString().split("T")[0]
                        }"></div>
                    </div>
                    <div class="form-group"><label>ملاحظات</label><textarea id="paymentNote" rows="2"></textarea></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal('paymentModalOverlay')">إلغاء</button>
                    <button class="btn btn-success" onclick="savePayment()">💾 تسجيل الدفعة</button>
                </div>
            </div>
        </div>`;
    document.getElementById("modalContainer").innerHTML = modalHTML;
    document.getElementById("paymentAmount")?.focus();
  };

  window.savePayment = function () {
    const customerId = parseInt(
      document.getElementById("paymentCustomer")?.value
    );
    const amount =
      parseFloat(document.getElementById("paymentAmount")?.value) || 0;
    const date =
      document.getElementById("paymentDate")?.value ||
      new Date().toISOString().split("T")[0];
    const note = document.getElementById("paymentNote")?.value.trim() || "";
    if (!customerId) {
      showToast("الرجاء اختيار العميل", "error");
      return;
    }
    if (amount <= 0) {
      showToast("الرجاء إدخال مبلغ صحيح", "error");
      return;
    }
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
    closeModal("paymentModalOverlay");
    renderPayments();
    renderDashboard();
    renderCustomers();
    showToast("تم تسجيل الدفعة بنجاح 💵");
  };

  window.deletePayment = function (id) {
    const payment = db.payments.find((p) => p.id === id);
    if (!payment) return;
    if (!confirm("هل أنت متأكد من حذف هذه الدفعة؟")) return;
    db.payments = db.payments.filter((p) => p.id !== id);
    updateCustomerBalance(payment.customerId);
    saveDB(db);
    renderPayments();
    renderDashboard();
    renderCustomers();
    showToast("تم حذف الدفعة 🗑️");
  };

  // ============ التقارير ============
  function renderReports() {
    const totalDebts = db.customers.reduce(
      (s, c) => s + Math.max(0, c.balance || 0),
      0
    );
    const totalCredits = db.customers.reduce(
      (s, c) => s + Math.max(0, -(c.balance || 0)),
      0
    );
    const totalInventoryValue = db.inventory.reduce(
      (s, i) => s + i.quantity * i.sellingPrice,
      0
    );
    const lowStockCount = db.inventory.filter(
      (i) => i.quantity <= (i.minAlert || 5)
    ).length;
    const totalSalesCount = db.sales.length;
    const totalPaymentsCount = db.payments.length;
    document.getElementById("reportStats").innerHTML = `
            <div class="stat-card"><div class="stat-icon red">💸</div><div class="stat-info"><h3>إجمالي الديون المستحقة</h3><div class="value positive">${formatCurrency(
              totalDebts
            )}</div></div></div>
            <div class="stat-card"><div class="stat-icon green">🏦</div><div class="stat-info"><h3>دائنون (للمتجر)</h3><div class="value">${formatCurrency(
              totalCredits
            )}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-info"><h3>قيمة المخزون</h3><div class="value">${formatCurrency(
              totalInventoryValue
            )}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange">⚠️</div><div class="stat-info"><h3>قطع تحتاج إعادة طلب</h3><div class="value">${lowStockCount}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">🛒</div><div class="stat-info"><h3>عدد المبيعات</h3><div class="value">${totalSalesCount}</div></div></div>
            <div class="stat-card"><div class="stat-icon green">💳</div><div class="stat-info"><h3>عدد التسديدات</h3><div class="value">${totalPaymentsCount}</div></div></div>
        `;
    const debtors = db.customers
      .filter((c) => (c.balance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
    const debtorsBody = document.getElementById("debtorsReportBody");
    if (debtors.length === 0) {
      debtorsBody.innerHTML =
        '<tr><td colspan="3"><div class="empty-state">🎉 لا يوجد عملاء مدينون - كل الديون مسددة</div></td></tr>';
    } else {
      debtorsBody.innerHTML = debtors
        .map(
          (c) => `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.phone || "-"}</td>
                    <td><span style="color:var(--danger);font-weight:700;">${formatCurrency(
                      c.balance
                    )}</span></td>
                </tr>`
        )
        .join("");
    }
  }

  // ============ المودالات ============
  window.closeModal = function (overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();
    document.getElementById("modalContainer").innerHTML = "";
  };

  document
    .getElementById("modalContainer")
    .addEventListener("click", function (e) {
      if (e.target.classList.contains("modal-overlay")) {
        e.target.remove();
      }
    });

  // ============ دوال عامة ============
  window.openCustomerModal = window.openCustomerModal;
  window.openInventoryModal = window.openInventoryModal;
  window.openSaleModal = window.openSaleModal;
  window.openPaymentModal = window.openPaymentModal;

  // ============ التهيئة الأولية ============
  function init() {
    if (!db.nextIds)
      db.nextIds = { customer: 1, inventory: 1, sale: 1, payment: 1 };
    if (!Array.isArray(db.customers)) db.customers = [];
    if (!Array.isArray(db.inventory)) db.inventory = [];
    if (!Array.isArray(db.sales)) db.sales = [];
    if (!Array.isArray(db.payments)) db.payments = [];
    db.customers.forEach((c) => updateCustomerBalance(c.id));
    saveDB(db);
    if (db.customers.length === 0 && db.inventory.length === 0) {
      seedDemoData();
    }
    renderDashboard();
  }

  function seedDemoData() {
    const c1 = {
      id: generateId("customer"),
      name: "أحمد محمد",
      phone: "01001234567",
      address: "القاهرة",
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    const c2 = {
      id: generateId("customer"),
      name: "محمود علي",
      phone: "01111234567",
      address: "الجيزة",
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    const c3 = {
      id: generateId("customer"),
      name: "سعيد حسين",
      phone: "01221234567",
      address: "الإسكندرية",
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    db.customers.push(c1, c2, c3);
    const i1 = {
      id: generateId("inventory"),
      partName: "فلتر زيت",
      partNumber: "FO-001",
      category: "فلاتر",
      quantity: 25,
      minAlert: 5,
      purchasePrice: 50,
      sellingPrice: 85,
      supplier: "الوكيل الرئيسي",
      createdAt: new Date().toISOString(),
    };
    const i2 = {
      id: generateId("inventory"),
      partName: "بطارية 70 أمبير",
      partNumber: "BAT-070",
      category: "بطاريات",
      quantity: 8,
      minAlert: 3,
      purchasePrice: 1800,
      sellingPrice: 2200,
      supplier: "شركة البطاريات",
      createdAt: new Date().toISOString(),
    };
    const i3 = {
      id: generateId("inventory"),
      partName: "طقم فرامل أمامي",
      partNumber: "BR-202",
      category: "فرامل",
      quantity: 12,
      minAlert: 4,
      purchasePrice: 650,
      sellingPrice: 950,
      supplier: "مستورد",
      createdAt: new Date().toISOString(),
    };
    const i4 = {
      id: generateId("inventory"),
      partName: "زيت محرك 5W-30",
      partNumber: "OIL-530",
      category: "زيوت",
      quantity: 3,
      minAlert: 10,
      purchasePrice: 200,
      sellingPrice: 320,
      supplier: "الوكيل",
      createdAt: new Date().toISOString(),
    };
    const i5 = {
      id: generateId("inventory"),
      partName: "شمعات احتراق (بوجيهات)",
      partNumber: "SP-004",
      category: "كهرباء",
      quantity: 40,
      minAlert: 8,
      purchasePrice: 120,
      sellingPrice: 200,
      supplier: "مستورد",
      createdAt: new Date().toISOString(),
    };
    const i6 = {
      id: generateId("inventory"),
      partName: "سير توقيت",
      partNumber: "TB-101",
      category: "محرك",
      quantity: 6,
      minAlert: 3,
      purchasePrice: 350,
      sellingPrice: 550,
      supplier: "الوكيل الرئيسي",
      createdAt: new Date().toISOString(),
    };
    db.inventory.push(i1, i2, i3, i4, i5, i6);
    const s1 = {
      id: generateId("sale"),
      customerId: c1.id,
      inventoryId: i1.id,
      quantity: 3,
      unitPrice: 85,
      total: 255,
      paid: 100,
      remaining: 155,
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
    };
    i1.quantity -= 3;
    db.sales.push(s1);
    const s2 = {
      id: generateId("sale"),
      customerId: c2.id,
      inventoryId: i3.id,
      quantity: 1,
      unitPrice: 950,
      total: 950,
      paid: 950,
      remaining: 0,
      date: new Date(Date.now() - 86400000).toISOString(),
    };
    i3.quantity -= 1;
    db.sales.push(s2);
    updateCustomerBalance(c1.id);
    updateCustomerBalance(c2.id);
    saveDB(db);
  }

  init();
})();
