db = db.getSiblingDB('docs')
print(db.getCollectionNames())
print(db.getCollection("docs").deleteMany({}))
print(db.getCollection("sessions").deleteMany({}))

