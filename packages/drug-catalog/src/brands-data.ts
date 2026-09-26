// Marcas comerciales frecuentes en México (curado a mano, FACTUAL: marca → principio activo → laboratorio). Es un
// subconjunto de lo más prescrito, NO el universo completo; el catálogo completo de COFEPRIS se ingiere aparte cuando se
// tenga el export (ver brands.ts / ingestión). La relación marca→principio activo es de dominio público y verificable; NO se
// inventan datos clínicos (la monografía viene del principio activo, en monographs.ts). Formato: `marca\tprincipio_activo\tlaboratorio`.
// laboratorio vacío = no confirmado (una marca puede tener varias presentaciones/titulares).
export const DRUG_BRANDS_TSV=`Tempra	paracetamol	Taisho
Tylenol	paracetamol	Janssen
Sinutab	paracetamol
Dolo-Neurobión	paracetamol	Procter & Gamble
Advil	ibuprofeno	Pfizer
Motrin	ibuprofeno	Pfizer
Actron	ibuprofeno	Bayer
Naxen	naproxeno	Roche
Flanax	naproxeno	Bayer
Aspirina	aspirina	Bayer
Voltaren	diclofenaco	Novartis
Cataflam	diclofenaco	Novartis
Dolo-Voltaren	diclofenaco	GSK
Celebrex	celecoxib	Viatris
Arcoxia	etoricoxib	Organon
Mobic	meloxicam	Boehringer Ingelheim
Toradol	ketorolaco
Buscapina	butilhioscina	Sanofi
Sensibit	loratadina	Liomont
Clarityne	loratadina	Bayer
Avapena	clorfenamina
Benadryl	difenhidramina	Johnson & Johnson
Aerius	desloratadina	Organon
Xyzal	levocetirizina
Zyrtec	cetirizina
Losacor	losartán	Landsteiner
Cozaar	losartán	Organon
Micardis	telmisartán	Boehringer Ingelheim
Diován	valsartán	Novartis
Norvas	amlodipino	Pfizer
Adalat	nifedipino	Bayer
Tenormin	atenolol
Concor	bisoprolol	Merck
Lopresor	metoprolol	Novartis
Inderalici	propranolol
Capoten	captopril
Renitec	enalapril	Organon
Zestril	lisinopril
Cardura	doxazosina	Pfizer
Lasix	furosemida	Sanofi
Aldactone	espironolactona	Pfizer
Lanoxin	digoxina
Glucophage	metformina	Merck
Dabex	metformina	Silanes
Amaryl	glimepirida	Sanofi
Januvia	sitagliptina	Organon
Galvus	vildagliptina	Novartis
Forxiga	dapagliflozina	AstraZeneca
Jardiance	empagliflozina	Boehringer Ingelheim
Lantus	insulina glargina	Sanofi
Levemir	insulina detemir	Novo Nordisk
NovoRapid	insulina aspart	Novo Nordisk
Humulin	insulina	Eli Lilly
Lipitor	atorvastatina	Viatris
Zocor	simvastatina	Organon
Crestor	rosuvastatina	AstraZeneca
Pravacol	pravastatina
Nexium	esomeprazol	AstraZeneca
Losec	omeprazol	AstraZeneca
Pantozol	pantoprazol	Takeda
Controloc	pantoprazol	Takeda
Melox	hidróxido de aluminio	Sanofi
Plasil	metoclopramida	Sanofi
Zofran	ondansetrón	Novartis
Motilium	domperidona
Dramamine	dimenhidrinato
Amoxil	amoxicilina	GSK
Augmentin	amoxicilina	GSK
Ciproxina	ciprofloxacino	Bayer
Avelox	moxifloxacino	Bayer
Tavanic	levofloxacino	Sanofi
Zithromax	azitromicina	Pfizer
Vibramicina	doxiciclina	Pfizer
Keflex	cefalexina
Bactrim	trimetoprima	Roche
Flagyl	metronidazol	Sanofi
Unasyn	ampicilina	Pfizer
Rocephin	ceftriaxona	Roche
Dalacin	clindamicina	Pfizer
Tramal	tramadol	Grünenthal
Tradol	tramadol
Neurontin	gabapentina	Pfizer
Lyrica	pregabalina	Pfizer
Rivotril	clonazepam	Roche
Tafil	alprazolam	Pfizer
Valium	diazepam	Roche
Ativan	lorazepam	Pfizer
Prozac	fluoxetina	Eli Lilly
Zoloft	sertralina	Pfizer
Paxil	paroxetina	GSK
Lexapro	escitalopram	Lundbeck
Cipralex	escitalopram	Lundbeck
Efexor	venlafaxina	Pfizer
Wellbutrin	bupropión	GSK
Seroquel	quetiapina	AstraZeneca
Risperdal	risperidona	Janssen
Zyprexa	olanzapina	Eli Lilly
Ventolin	salbutamol	GSK
Salbutamol	salbutamol
Symbicort	budesonida	AstraZeneca
Seretide	fluticasona	GSK
Singulair	montelukast	Organon
Mucosolvan	ambroxol	Sanofi
Eutirox	levotiroxina	Merck
Synthroid	levotiroxina	Abbott
Coumadin	warfarina	Bristol-Myers Squibb
Xarelto	rivaroxabán	Bayer
Eliquis	apixabán	Bristol-Myers Squibb
Pradaxa	dabigatrán	Boehringer Ingelheim
Plavix	clopidogrel	Sanofi
Furadantina	nitrofurantoína
Canesten	clotrimazol	Bayer
Diflucan	fluconazol	Pfizer
Nizoral	ketoconazol	Janssen
Daktarin	miconazol	Janssen
Lamisil	terbinafina	Novartis
Zovirax	aciclovir	GSK
Prednisona	prednisona
Decadron	dexametasona
Celestone	betametasona	Organon
Redoxon	vitamina C	Bayer
Bedoyecta	complejo b	Grossman
Neurobión	complejo b	Procter & Gamble
Cytotec	misoprostol	Pfizer
Pepto-Bismol	subsalicilato de bismuto	Procter & Gamble`;
