DROP TYPE IF EXISTS branduri_bijuterie;
DROP TYPE IF EXISTS tipuri_bijuterii;

CREATE TYPE branduri_bijuterie AS ENUM( 'KillStar', 'Demonia', 'Winx', 'BlackMist');
CREATE TYPE tipuri_bijuterii AS ENUM('inele', 'cercei', 'medalioane', 'bratari','piercinguri');


CREATE TABLE IF NOT EXISTS bijuterii (
   id serial PRIMARY KEY,
   nume VARCHAR(50) UNIQUE NOT NULL,
   descriere TEXT,
   pret NUMERIC(8,2) NOT NULL,
   nr_bucati INT NOT NULL CHECK (nr_bucati>=0),
   tip_produs tipuri_bijuterii,
   brand branduri_bijuterie ,
   materiale VARCHAR [],
   gravura_custom BOOLEAN NOT NULL DEFAULT FALSE,
   imagine VARCHAR(300),
   data_adaugare TIMESTAMP DEFAULT current_timestamp
);

INSERT into bijuterii (nume,descriere,pret, nr_bucati, tip_produs, brand, materiale, gravura_custom, imagine) VALUES 
('Inel BatWings', 'Inel cu aripi de liliac', 70.5, 170, 'inele', 'KillStar', '{"aliaj zinc","onix","argint"}', True, 'Inel-BatWings.jpeg'),
('Bratara LuckyStones', 'Bratara din pietre semipretioase ', 45, 230, 'bratari', 'Demonia', '{"ametist", "topaz", "agat","argint"}', False, 'luckystones.jpeg'),
('Cercei Semiluna', 'Cercei lungi in forma de semiluna cu piatra', 38.70, 98, 'cercei', 'Demonia', '{"ametist","argint"}', False, 'cercei-semiluna.jpeg'),
('Inel BirdSkull', 'Inel cu craniu de corb reglabil', 84.90, 214, 'inele', 'BlackMist', '{"otel inoxidabil","aliaj de zinc"}', False, 'BirdSkull.jpeg'),
('Inel WildDead', 'Inel cu sculptura in forma de craniu de bivol', 115.90, 58, 'inele', 'Winx', '{"otel inoxidabil","aliaj de zinc"}', True, 'Inel-craniu-bivol.jpeg'),
('Medalion RegalRomance', 'Medalion gotic cu rubin', 210, 212, 'medalioane', 'BlackMist', '{"rubin","argint"}', False, 'medalion-rubin.jpg'),
('Pierce BloodyHeart', 'Piercing buric lung cu inima', 65.40, 107, 'piercinguri', 'Winx', '{"aliaj zinc","argint"}', False, 'piercing-buric.jpg'),
('Medalion BatWings', 'Medalion gotic cu rubin si rama in forma de aripi de liliac', 230, 212, 'medalioane', 'KillStar', '{"rubin","argint"}', True, 'medalion-batwings.jpg'),
('Cercei BatWings', 'Cercei lungi in forma de aripi de liliac', 50, 17, 'cercei', 'KillStar', '{"aliaj zinc","argint"}', False, 'cercei-batwings.jpg');
