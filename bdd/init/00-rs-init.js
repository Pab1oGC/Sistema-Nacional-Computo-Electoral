try {
  var r = rs.initiate({
    _id: "rrv-rs",
    members: [
      { _id: 0, host: "mongo1:27017", priority: 1 },
      { _id: 1, host: "mongo2:27017", priority: 3 },
      { _id: 2, host: "mongo3:27017", priority: 1 }
    ]
  });
  if (r.ok === 1) print("iniciado");
  else printjson(r);
} catch(e) {
  if (e.codeName === "AlreadyInitialized") print("ya_ok");
  else throw e;
}
