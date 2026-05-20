import { useState, useEffect } from "react";

const SLOTS = ["Before School", "Break Time", "Lunch"];
const ITEMS = ["Lays", "Biscuits"];

function toKey(date, item) { return date + "__" + item; }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function nextDays(n) {
  const days = [], base = new Date();
  for (let i = 0; i < n; i++) {
    const c = new Date(base);
    c.setDate(base.getDate() + i);
    days.push(c.toISOString().split("T")[0]);
  }
  return days;
}

async function loadUsers() {
  try {
    const res = await window.storage.list("usr:");
    const out = {};
    for (const k of res.keys) {
      try { const r = await window.storage.get(k); if (r) out[k.replace("usr:","")] = JSON.parse(r.value); } catch {}
    }
    return out;
  } catch { return {}; }
}
async function loadBookings() {
  try {
    const res = await window.storage.list("bk:");
    const out = {};
    for (const k of res.keys) {
      try { const r = await window.storage.get(k); if (r) out[k.replace("bk:","")] = JSON.parse(r.value); } catch {}
    }
    return out;
  } catch { return {}; }
}

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400";
const yBtn = "w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-2 rounded-lg text-sm transition";
const gBtn = "w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm transition";

export default function App() {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState({});
  const [bookings, setBookings] = useState({});
  const [page, setPage] = useState("login");
  const [me, setMe] = useState(null);

  const [lname, setLname] = useState("");
  const [lpass, setLpass] = useState("");
  const [rname, setRname] = useState("");
  const [rpass, setRpass] = useState("");
  const [msg, setMsg] = useState("");
  const [bMsg, setBMsg] = useState("");

  const [selDate, setSelDate] = useState(todayStr());
  const [selSlot, setSelSlot] = useState(SLOTS[0]);

  const [aTab, setATab] = useState("bookings");
  const [editUsr, setEditUsr] = useState(null);
  const [editPw, setEditPw] = useState("");
  const [newAdminPw, setNewAdminPw] = useState("");
  const [needsAdminPw, setNeedsAdminPw] = useState(false);

  const refresh = async () => {
    setUsers(await loadUsers());
    setBookings(await loadBookings());
  };

  useEffect(() => {
    (async () => {
      try { await window.storage.get("usr:admin"); }
      catch {
        await window.storage.set("usr:admin", JSON.stringify({ name: "Admin", password: "__UNSET__", isAdmin: true }));
      }
      await refresh();
      setReady(true);
    })();
  }, []);

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-yellow-50 text-gray-500 text-sm">
      Loading...
    </div>
  );

  const getBooking = (date, item) => bookings[toKey(date, item)] || null;

  const handleLogin = async () => {
    setMsg("");
    const key = lname.trim().toLowerCase();
    const u = users[key];
    if (!u) return setMsg("Account not found.");
    if (u.password === "__UNSET__" && u.isAdmin) { setMe({ ...u, username: key }); setPage("admin"); setNeedsAdminPw(true); return; }
    if (u.password !== lpass) return setMsg("Wrong password.");
    setMe({ ...u, username: key });
    setPage(u.isAdmin ? "admin" : "home");
  };

  const handleRegister = async () => {
    setMsg("");
    const key = rname.trim().toLowerCase();
    if (!key || !rpass) return setMsg("Please fill in all fields.");
    if (key === "admin") return setMsg("That name is reserved.");
    if (users[key]) return setMsg("Name already taken.");
    await window.storage.set("usr:" + key, JSON.stringify({ name: rname.trim(), password: rpass, isAdmin: false }));
    await refresh();
    setMsg("Account created! You can now log in.");
    setRname(""); setRpass("");
    setPage("login");
  };

  const handleBook = async (item) => {
    setBMsg("");
    const existing = getBooking(selDate, item);
    if (existing) {
      if (existing.user === me.username) return setBMsg("You already booked " + item + " for " + fmtDate(selDate) + ".");
      const days = nextDays(14);
      const next = days.find(d => d > selDate && !getBooking(d, item));
      return setBMsg(existing.bookedName + " already booked " + item + " for " + fmtDate(selDate) + ". Next free: " + (next ? fmtDate(next) : "None in 2 weeks") + ".");
    }
    await window.storage.set("bk:" + toKey(selDate, item), JSON.stringify({
      user: me.username, bookedName: me.name, item, date: selDate, slot: selSlot
    }));
    await refresh();
    setBMsg("Booked " + item + " for " + fmtDate(selDate) + " at " + selSlot + "!");
  };

  const cancelBooking = async (date, item) => {
    const b = getBooking(date, item);
    if (!b) return;
    if (!me.isAdmin && b.user !== me.username) return;
    await window.storage.delete("bk:" + toKey(date, item));
    await refresh();
    setBMsg("Booking cancelled.");
  };

  const setAdminPass = async () => {
    if (!newAdminPw) return;
    const u = users["admin"];
    await window.storage.set("usr:admin", JSON.stringify({ ...u, password: newAdminPw }));
    await refresh();
    setNeedsAdminPw(false);
    setNewAdminPw("");
    alert("Admin password set!");
  };

  const saveUserPass = async () => {
    if (!editUsr || !editPw) return;
    const u = users[editUsr];
    await window.storage.set("usr:" + editUsr, JSON.stringify({ ...u, password: editPw }));
    await refresh();
    setEditUsr(null); setEditPw("");
  };

  const deleteUser = async (key) => {
    if (!window.confirm("Delete user " + users[key]?.name + "?")) return;
    await window.storage.delete("usr:" + key);
    for (const bk of Object.keys(bookings)) {
      if (bookings[bk].user === key) await window.storage.delete("bk:" + bk);
    }
    await refresh();
  };

  const logout = () => { setMe(null); setPage("login"); setLname(""); setLpass(""); setMsg(""); setBMsg(""); };

  // ---- LOGIN / REGISTER ----
  if (page === "login" || page === "register") {
    return (
      <div className="min-h-screen bg-yellow-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm">
          <div className="text-center mb-5">
            <div className="text-4xl mb-1">&#x1F35F;&#x1F36A;</div>
            <h1 className="text-2xl font-extrabold text-gray-800">Snack Booking</h1>
            <p className="text-gray-500 text-xs mt-1">Book your Lays and Biscuits slot</p>
          </div>
          {page === "login" ? (
            <div className="space-y-3">
              <h2 className="font-bold text-gray-700">Login</h2>
              <input className={inp} placeholder="Name" value={lname} onChange={e => setLname(e.target.value)} />
              <input className={inp} placeholder="Password" type="password" value={lpass} onChange={e => setLpass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
              {msg && <p className="text-red-500 text-xs">{msg}</p>}
              <button className={yBtn} onClick={handleLogin}>Login</button>
              <button className={gBtn} onClick={() => { setPage("register"); setMsg(""); }}>Create Account</button>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="font-bold text-gray-700">Create Account</h2>
              <input className={inp} placeholder="Your Name" value={rname} onChange={e => setRname(e.target.value)} />
              <input className={inp} placeholder="Password" type="password" value={rpass} onChange={e => setRpass(e.target.value)} />
              {msg && <p className="text-red-500 text-xs">{msg}</p>}
              <button className={yBtn} onClick={handleRegister}>Create Account</button>
              <button className={gBtn} onClick={() => { setPage("login"); setMsg(""); }}>Back to Login</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- HOME ----
  if (page === "home") {
    const days = nextDays(7);
    const myUpcoming = Object.values(bookings).filter(b => b.user === me.username && b.date >= todayStr()).sort((a, b) => a.date.localeCompare(b.date));
    return (
      <div className="min-h-screen bg-yellow-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-extrabold text-gray-800">&#x1F35F; Snack Booking</h1>
              <p className="text-xs text-gray-500">Hi, {me.name}!</p>
            </div>
            <button onClick={logout} className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-full font-semibold">Logout</button>
          </div>

          <div className="bg-white rounded-xl shadow p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Select Day</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map(d => (
                <button key={d} onClick={() => { setSelDate(d); setBMsg(""); }}
                  className={"flex-shrink-0 rounded-lg px-3 py-2 text-xs font-bold border transition " + (selDate === d ? "bg-yellow-400 border-yellow-400 text-gray-900" : "border-gray-200 text-gray-600 hover:border-yellow-300")}>
                  <div>{new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" })}</div>
                  <div>{new Date(d + "T00:00:00").getDate()}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Select Slot</p>
            <div className="flex gap-2">
              {SLOTS.map(s => (
                <button key={s} onClick={() => setSelSlot(s)}
                  className={"flex-1 py-2 rounded-lg text-xs font-bold border transition " + (selSlot === s ? "bg-yellow-400 border-yellow-400 text-gray-900" : "border-gray-200 text-gray-600 hover:border-yellow-300")}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Available Snacks</p>
            {bMsg && <p className="text-sm mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-gray-700">{bMsg}</p>}
            <div className="space-y-3">
              {ITEMS.map(item => {
                const b = getBooking(selDate, item);
                const mine = b && b.user === me.username;
                const taken = b && !mine;
                return (
                  <div key={item} className={"rounded-xl border-2 p-3 flex items-center justify-between " + (mine ? "border-green-400 bg-green-50" : taken ? "border-red-200 bg-red-50" : "border-gray-200")}>
                    <div>
                      <p className="font-bold text-gray-800">{item === "Lays" ? "&#x1F35F;" : "&#x1F36A;"} {item}</p>
                      {mine && <p className="text-xs text-green-600 font-semibold">You booked this &middot; {b.slot}</p>}
                      {taken && <p className="text-xs text-red-500 font-semibold">Booked by {b.bookedName}</p>}
                      {!b && <p className="text-xs text-gray-400">Available</p>}
                    </div>
                    {mine ? (
                      <button onClick={() => cancelBooking(selDate, item)} className="text-xs bg-red-100 hover:bg-red-200 text-red-600 font-bold px-3 py-1 rounded-lg">Cancel</button>
                    ) : taken ? (
                      <span className="text-xs bg-red-100 text-red-400 font-bold px-3 py-1 rounded-lg">Taken</span>
                    ) : (
                      <button onClick={() => handleBook(item)} className="text-xs bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-3 py-1 rounded-lg">Book</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">My Upcoming Bookings</p>
            {myUpcoming.length === 0 && <p className="text-xs text-gray-400">No upcoming bookings.</p>}
            {myUpcoming.map((b, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-bold">{b.item === "Lays" ? "&#x1F35F;" : "&#x1F36A;"} {b.item}</p>
                  <p className="text-xs text-gray-500">{fmtDate(b.date)} &middot; {b.slot}</p>
                </div>
                <button onClick={() => cancelBooking(b.date, b.item)} className="text-xs text-red-500 hover:underline">Cancel</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- ADMIN ----
  if (page === "admin") {
    if (needsAdminPw) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm">
            <h2 className="font-extrabold text-lg mb-2">Set Admin Password</h2>
            <p className="text-xs text-gray-500 mb-4">First time setup — set your admin password.</p>
            <input className={inp} placeholder="New admin password" type="password" value={newAdminPw} onChange={e => setNewAdminPw(e.target.value)} />
            <button className={yBtn + " mt-3"} onClick={setAdminPass}>Set Password</button>
          </div>
        </div>
      );
    }

    const allBookings = Object.values(bookings).sort((a, b) => a.date.localeCompare(b.date));
    const nonAdmins = Object.entries(users).filter(([k]) => k !== "admin");

    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-extrabold text-white">Admin Panel</h1>
              <p className="text-xs text-gray-400">Snack Booking Manager</p>
            </div>
            <button onClick={logout} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-full font-semibold">Logout</button>
          </div>

          <div className="flex gap-2 mb-4">
            {["bookings","users","settings"].map(t => (
              <button key={t} onClick={() => setATab(t)}
                className={"flex-1 py-2 rounded-lg text-xs font-bold capitalize transition " + (aTab === t ? "bg-yellow-400 text-gray-900" : "bg-gray-700 text-gray-300 hover:bg-gray-600")}>
                {t}
              </button>
            ))}
          </div>

          {aTab === "bookings" && (
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-3">All Bookings ({allBookings.length})</p>
              {allBookings.length === 0 && <p className="text-xs text-gray-400">No bookings yet.</p>}
              {allBookings.map((b, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-bold">{b.item} <span className="font-normal text-gray-500">booked by {b.bookedName}</span></p>
                    <p className="text-xs text-gray-500">{fmtDate(b.date)} &middot; {b.slot}</p>
                  </div>
                  <button onClick={() => cancelBooking(b.date, b.item)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              ))}
            </div>
          )}

          {aTab === "users" && (
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-3">Users ({nonAdmins.length})</p>
              {nonAdmins.length === 0 && <p className="text-xs text-gray-400">No users yet.</p>}
              {nonAdmins.map(([key, u]) => {
                const ub = allBookings.filter(b => b.user === key);
                return (
                  <div key={key} className="py-3 border-b last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{ub.length} booking{ub.length !== 1 ? "s" : ""}</p>
                        {ub.map((b, i) => (
                          <p key={i} className="text-xs text-yellow-700 mt-0.5">{b.item} &middot; {fmtDate(b.date)} &middot; {b.slot}</p>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditUsr(key); setEditPw(""); }} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded font-semibold">Edit</button>
                        <button onClick={() => deleteUser(key)} className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded font-semibold">Del</button>
                      </div>
                    </div>
                    {editUsr === key && (
                      <div className="mt-2 flex gap-2">
                        <input className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" placeholder="New password" type="password" value={editPw} onChange={e => setEditPw(e.target.value)} />
                        <button onClick={saveUserPass} className="text-xs bg-green-400 hover:bg-green-500 text-white px-3 py-1 rounded font-bold">Save</button>
                        <button onClick={() => setEditUsr(null)} className="text-xs bg-gray-200 px-2 py-1 rounded">X</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {aTab === "settings" && (
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-3">Admin Settings</p>
              <p className="text-sm font-semibold text-gray-700 mb-2">Change Admin Password</p>
              <input className={inp} placeholder="New admin password" type="password" value={newAdminPw} onChange={e => setNewAdminPw(e.target.value)} />
              <button className={yBtn + " mt-2"} onClick={setAdminPass}>Update Password</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
