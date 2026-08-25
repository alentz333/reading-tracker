-- User connections: lets readers find each other and become friends.
-- A row is a request from requester_id to addressee_id; 'accepted' means
-- both sides are connected. Rejecting/cancelling/unfriending just deletes
-- the row. The app checks for an existing row in either direction before
-- inserting a new request, so A->B and B->A can't both exist at once.

create table public.user_connections (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted')) default 'pending' not null,
  created_at timestamptz default now(),

  unique(requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index user_connections_requester_idx on public.user_connections(requester_id);
create index user_connections_addressee_idx on public.user_connections(addressee_id);

alter table public.user_connections enable row level security;

-- Either side of a connection can see it
create policy "Users can view their own connections" on public.user_connections
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Only the requester can create the initial request
create policy "Users can send connection requests" on public.user_connections
  for insert with check (auth.uid() = requester_id);

-- Only the addressee can accept a pending request
create policy "Addressee can accept a request" on public.user_connections
  for update using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

-- Either side can remove a connection (cancel a request, decline it, or unfriend)
create policy "Either side can remove a connection" on public.user_connections
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);
