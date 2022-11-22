db = db.getSiblingDB('docs')
print(db.getCollectionNames())
print(db.getCollection("docs").deleteMany({}))
